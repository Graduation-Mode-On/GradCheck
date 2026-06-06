import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { GpaCourseInput } from "./gpa.types.js";

export interface TranscriptTextItem {
  str: string;
  x: number;
  y: number;
}

export interface TranscriptCoursePreview extends GpaCourseInput {
  rawName: string;
  rawGrade: string;
  exclusionReason: string | null;
  warnings: string[];
}

interface TableColumn {
  nameStart: number;
  creditStart: number;
  gradeStart: number;
  right: number;
}

const TABLE_COLUMNS: TableColumn[] = [
  { nameStart: 60, creditStart: 185, gradeStart: 215, right: 240 },
  { nameStart: 240, creditStart: 360, gradeStart: 390, right: 415 },
  { nameStart: 415, creditStart: 535, gradeStart: 565, right: 595 },
  { nameStart: 630, creditStart: 705, gradeStart: 735, right: 770 }
];

const EXCLUDED_MARKERS = new Set(["▲", "●", "*", "☆"]);

export async function parseTranscriptPdf(buffer: Buffer): Promise<TranscriptCoursePreview[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const verbosityLevel = (pdfjs as unknown as { VerbosityLevel?: { ERRORS?: number } }).VerbosityLevel;
  const documentTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: standardFontDataUrl(),
    verbosity: verbosityLevel?.ERRORS ?? 0
  });
  const pdf = await documentTask.promise;
  const items: TranscriptTextItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = item.str?.trim();
      if (!str || !item.transform) {
        continue;
      }
      items.push({ str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 });
    }
  }

  await pdf.destroy();
  return parseTranscriptTextItems(items);
}

function standardFontDataUrl(): string {
  const require = createRequire(import.meta.url);
  const pdfjsEntry = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  return `${join(dirname(pdfjsEntry), "../../standard_fonts/")}/`;
}

export function parseTranscriptTextItems(items: TranscriptTextItem[]): TranscriptCoursePreview[] {
  const rows = groupRows(items);
  const courses: TranscriptCoursePreview[] = [];
  let currentTerm: string | null = null;

  for (const column of TABLE_COLUMNS) {
    for (const row of rows) {
      const cell = readColumnCell(row.items, column);
      if (!cell.name) {
        continue;
      }

      const term = parseTranscriptTerm(cell.name);
      if (term) {
        currentTerm = term;
        continue;
      }

      if (!currentTerm || isNonCourseText(cell.name) || !cell.credit || !cell.grade) {
        continue;
      }

      const course = toTranscriptCourse(currentTerm, cell.name, cell.credit, cell.grade);
      if (course) {
        courses.push(course);
      }
    }
  }

  return courses;
}

function groupRows(items: TranscriptTextItem[]) {
  const rowMap = new Map<number, TranscriptTextItem[]>();
  for (const item of items) {
    const rowKey = Math.round(item.y / 2) * 2;
    const row = rowMap.get(rowKey) ?? [];
    row.push(item);
    rowMap.set(rowKey, row);
  }

  return [...rowMap.entries()]
    .map(([y, rowItems]) => ({
      y,
      items: rowItems.sort((left, right) => left.x - right.x)
    }))
    .sort((left, right) => right.y - left.y);
}

function readColumnCell(items: TranscriptTextItem[], column: TableColumn) {
  const inColumn = items.filter((item) => item.x >= column.nameStart && item.x < column.right);
  const name = inColumn
    .filter((item) => item.x < column.creditStart)
    .map((item) => item.str)
    .join("")
    .trim();
  const credit = inColumn
    .filter((item) => item.x >= column.creditStart && item.x < column.gradeStart)
    .map((item) => item.str)
    .join("")
    .trim();
  const grade = inColumn
    .filter((item) => item.x >= column.gradeStart)
    .map((item) => item.str)
    .join("")
    .trim();

  return { name, credit, grade };
}

function parseTranscriptTerm(value: string): string | null {
  const match = value.match(/(\d{4})-(\d{4})学年([13])-([24])学期/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]} ${match[3] === "1" ? "秋" : "春"}`;
}

function isNonCourseText(value: string): boolean {
  return (
    value.includes("课程名称") ||
    value.includes("以下为空") ||
    value.startsWith("备注") ||
    value.startsWith("成绩") ||
    value.startsWith("绩点") ||
    value.startsWith("全国大学英语") ||
    value.includes("签章")
  );
}

function toTranscriptCourse(term: string, rawName: string, credit: string, rawGrade: string): TranscriptCoursePreview | null {
  if (!/^\d+(\.\d+)?$/.test(credit)) {
    return null;
  }

  const marker = rawName.trim().charAt(0);
  const hasExcludedMarker = EXCLUDED_MARKERS.has(marker);
  const name = hasExcludedMarker ? rawName.trim().slice(1).trim() : rawName.trim();
  const grade = normalizeGrade(rawGrade);
  const warnings: string[] = [];
  let isGpaEligible = grade.isGpaEligible && !hasExcludedMarker;
  let exclusionReason = grade.exclusionReason;

  if (hasExcludedMarker) {
    isGpaEligible = false;
    exclusionReason = "通识/辅修/国外学习/非本专业课程不计入 GPA";
  }

  if (!grade.isNumericGrade) {
    warnings.push(`成绩 ${rawGrade} 已按规则换算为 ${grade.score}`);
  }

  if (exclusionReason) {
    warnings.push(exclusionReason);
  }

  return {
    term,
    name,
    credit,
    score: grade.score,
    isRequired: false,
    isFirstAttempt: true,
    isGpaEligible,
    rawName,
    rawGrade,
    exclusionReason,
    warnings
  };
}

function normalizeGrade(rawGrade: string) {
  if (/^\d+(\.\d+)?$/.test(rawGrade)) {
    return { score: rawGrade, isGpaEligible: true, isNumericGrade: true, exclusionReason: null };
  }

  const gradeMap: Record<string, string> = {
    优: "95",
    良: "85",
    中: "75",
    及格: "65",
    不及格: "59"
  };

  if (rawGrade in gradeMap) {
    return { score: gradeMap[rawGrade], isGpaEligible: true, isNumericGrade: false, exclusionReason: null };
  }

  if (["通过", "合格", "P"].includes(rawGrade)) {
    return {
      score: "0",
      isGpaEligible: false,
      isNumericGrade: false,
      exclusionReason: "通过/合格类成绩不计入 GPA"
    };
  }

  return {
    score: "0",
    isGpaEligible: false,
    isNumericGrade: false,
    exclusionReason: `无法识别成绩 ${rawGrade}，不计入 GPA`
  };
}
