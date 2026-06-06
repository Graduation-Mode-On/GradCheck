import { readFile } from "node:fs/promises";

export interface OcrPageInput {
  pdfPath: string;
  pageNumber: number;
}

export interface OcrResult {
  text: string;
  warnings: string[];
}

export interface PageOcr {
  recognizePage(input: OcrPageInput): Promise<OcrResult>;
}

export class HttpPaddleOcrClient implements PageOcr {
  constructor(private readonly endpoint: string) {}

  async recognizePage(input: OcrPageInput): Promise<OcrResult> {
    const pdfBytes = await readFile(input.pdfPath);
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pageNumber: input.pageNumber,
        pdfBase64: pdfBytes.toString("base64")
      })
    });

    if (!response.ok) {
      return { text: "", warnings: [`paddleocr_http_failed:${response.status}`] };
    }

    const payload = (await response.json()) as { text?: string; warnings?: string[] };
    return {
      text: payload.text ?? "",
      warnings: payload.warnings ?? []
    };
  }
}

