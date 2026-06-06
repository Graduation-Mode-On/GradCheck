declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export interface PdfDocumentLoadingTask {
    promise: Promise<PdfDocument>;
  }

  export interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
    destroy(): Promise<void>;
  }

  export interface PdfPage {
    getTextContent(): Promise<{ items: unknown[] }>;
  }

  export function getDocument(options: Record<string, unknown>): PdfDocumentLoadingTask;
}

