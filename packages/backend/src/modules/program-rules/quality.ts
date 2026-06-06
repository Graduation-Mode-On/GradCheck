import type { PageQuality, TableBlock } from "./models.js";

export interface PageQualityOptions {
  minScore?: number;
  minTextChars?: number;
  minTableCells?: number;
}

export class PageQualityEvaluator {
  private readonly minScore: number;
  private readonly minTextChars: number;
  private readonly minTableCells: number;

  constructor(options: PageQualityOptions = {}) {
    this.minScore = options.minScore ?? 0.55;
    this.minTextChars = options.minTextChars ?? 120;
    this.minTableCells = options.minTableCells ?? 12;
  }

  evaluate(text: string, tables: TableBlock[]): PageQuality {
    const compactText = text.replace(/\s+/g, "");
    const textChars = compactText.length;
    const lineCount = text.split(/\r?\n/).filter((line) => line.trim()).length;
    const nonEmptyTableCells = tables.reduce((count, table) => {
      return count + table.rows.flat().filter((cell) => cell.trim()).length;
    }, 0);
    const replacementChars = [...compactText].filter((char) => char === "\uFFFD" || char === "?").length;
    const replacementRatio = replacementChars / Math.max(textChars, 1);

    let score = 0;
    score += Math.min(textChars / 900, 0.45);
    score += Math.min(lineCount / 28, 0.2);
    score += Math.min(nonEmptyTableCells / 80, 0.25);
    score += /\d+(?:\.\d+)?\s*学分/.test(text) ? 0.1 : 0;
    score -= Math.min(replacementRatio * 2, 0.35);
    score = Math.max(0, Math.min(score, 1));

    const issues: string[] = [];
    if (textChars < this.minTextChars) issues.push("text_layer_too_short");
    if (nonEmptyTableCells < this.minTableCells) issues.push("few_table_cells");
    if (replacementRatio > 0.08) issues.push("many_replacement_chars");
    if (score < this.minScore) issues.push("low_quality_score");

    return {
      score: Number(score.toFixed(3)),
      passed: score >= this.minScore && (textChars >= this.minTextChars || nonEmptyTableCells >= this.minTableCells),
      issues,
      textChars,
      nonEmptyTableCells
    };
  }
}

