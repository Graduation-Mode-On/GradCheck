import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { PageParseResult, TableBlock } from "./models.js";
import type { PageOcr } from "./ocr.js";
import { PageQualityEvaluator } from "./quality.js";

export interface PdfPageExtraction {
  pageNumber: number;
  text: string;
  tables: TableBlock[];
  warnings: string[];
}

export interface PdfTextExtractor {
  extract(pdfPath: string): Promise<PdfPageExtraction[]>;
}

export class PdfJsTextExtractor implements PdfTextExtractor {
  async extract(pdfPath: string): Promise<PdfPageExtraction[]> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const verbosityLevel = (pdfjs as unknown as { VerbosityLevel?: { ERRORS?: number } }).VerbosityLevel;
    const data = await readFile(pdfPath);
    const documentTask = pdfjs.getDocument({
      data: new Uint8Array(data),
      useWorkerFetch: false,
      isEvalSupported: false,
      standardFontDataUrl: standardFontDataUrl(),
      verbosity: verbosityLevel?.ERRORS ?? 0
    });
    const pdf = await documentTask.promise;
    const pages: PdfPageExtraction[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = textItemsToLines(content.items as PdfTextItem[]);
      pages.push({
        pageNumber,
        text,
        tables: deriveTablesFromText(text),
        warnings: []
      });
    }

    await pdf.destroy();
    return pages;
  }
}

function standardFontDataUrl(): string {
  const require = createRequire(import.meta.url);
  const pdfjsEntry = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  return `${join(dirname(pdfjsEntry), "../../standard_fonts/")}/`;
}

export interface PdfParseOptions {
  textExtractor?: PdfTextExtractor;
  qualityEvaluator?: PageQualityEvaluator;
  ocr?: PageOcr;
}

export class ProgramPdfParser {
  private readonly textExtractor: PdfTextExtractor;
  private readonly qualityEvaluator: PageQualityEvaluator;
  private readonly ocr?: PageOcr;

  constructor(options: PdfParseOptions = {}) {
    this.textExtractor = options.textExtractor ?? new PdfJsTextExtractor();
    this.qualityEvaluator = options.qualityEvaluator ?? new PageQualityEvaluator();
    this.ocr = options.ocr;
  }

  async parse(pdfPath: string): Promise<PageParseResult[]> {
    if (!pdfPath.toLowerCase().endsWith(".pdf")) {
      throw new Error(`Expected a PDF file: ${pdfPath}`);
    }

    const pages = await this.textExtractor.extract(pdfPath);
    const results: PageParseResult[] = [];

    for (const page of pages) {
      const quality = this.qualityEvaluator.evaluate(page.text, page.tables);
      if (quality.passed) {
        results.push({
          pageNumber: page.pageNumber,
          method: "pdfjs",
          text: page.text,
          tables: page.tables,
          quality,
          warnings: page.warnings
        });
        continue;
      }

      const warnings = [...page.warnings, ...quality.issues];
      if (!this.ocr) {
        results.push({
          pageNumber: page.pageNumber,
          method: "pdfjs",
          text: page.text,
          tables: page.tables,
          quality,
          warnings: [...warnings, "ocr_not_configured"]
        });
        continue;
      }

      const ocrResult = await this.ocr.recognizePage({ pdfPath, pageNumber: page.pageNumber });
      results.push({
        pageNumber: page.pageNumber,
        method: "paddleocr",
        text: ocrResult.text,
        tables: deriveTablesFromText(ocrResult.text, "ocr-derived"),
        quality,
        warnings: [...warnings, ...ocrResult.warnings]
      });
    }

    return results;
  }
}

interface PdfTextItem {
  str: string;
  transform?: number[];
  width?: number;
}

function textItemsToLines(items: PdfTextItem[]): string {
  const positioned = items
    .filter((item) => item.str.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform?.[4] ?? 0,
      y: Math.round((item.transform?.[5] ?? 0) * 10) / 10
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) < 2);
    if (line) {
      line.parts.push({ x: item.x, text: item.text });
    } else {
      lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
    }
  }

  return lines
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" "))
    .join("\n");
}

export function deriveTablesFromText(text: string, source: TableBlock["source"] = "text-derived"): TableBlock[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /课程|学分|必修|选修|\t|\s{2,}|^[A-Z0-9]{5,12}\s+/.test(line))
    .map((line) => line.split(/\t+|\s{2,}| {1,}(?=\d+(?:\.\d+)?(?:\s*学分)?\b)/).map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length >= 2);

  return rows.length > 0 ? [{ rows, source }] : [];
}
