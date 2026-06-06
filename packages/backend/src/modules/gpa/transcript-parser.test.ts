import { describe, expect, it } from "vitest";

import { parseTranscriptTextItems } from "./transcript-parser.js";

function item(str: string, x: number, y: number) {
  return { str, x, y };
}

describe("parseTranscriptTextItems", () => {
  it("parses Southeast University transcript rows across continued table columns", () => {
    const courses = parseTranscriptTextItems([
      item("2022-2023学年1-2学期", 113, 518),
      item("工科数学分析I", 72, 486),
      item("6", 200, 486),
      item("88", 226, 486),
      item("2022-2023学年3-4学期", 113, 382),
      item("体育II", 72, 298),
      item("0.5", 195, 298),
      item("82", 226, 298),
      item("2023-2024学年3-4学期", 113, 172),
      item("▲虚拟现实技术", 247, 518),
      item("2", 374, 518),
      item("76", 401, 518),
      item("大学物理实验(理工)I", 247, 508),
      item("1", 374, 508),
      item("优", 401, 508),
      item("工业系统认识1", 72, 414),
      item("0.5", 195, 414),
      item("通过", 226, 414),
      item("2025-2026学年3-4学期", 463, 466),
      item("3.53.02.82.5", 464, 446),
      item("2", 545, 446),
      item("1.8", 573, 446),
      item("IT新技术讲座（校企）", 464, 456),
      item("0.5", 545, 456),
      item("良", 573, 456),
      item("-------以下为空-------", 458, 434)
    ]);

    expect(courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        term: "2022-2023 秋",
        name: "工科数学分析I",
        credit: "6",
        score: "88",
        rawGrade: "88",
        isGpaEligible: true
      }),
      expect.objectContaining({
        term: "2022-2023 春",
        name: "体育II",
        credit: "0.5",
        score: "82",
        rawGrade: "82",
        isGpaEligible: true
      }),
      expect.objectContaining({
        term: "2023-2024 春",
        name: "虚拟现实技术",
        credit: "2",
        score: "76",
        rawGrade: "76",
        isGpaEligible: false,
        exclusionReason: "通识/辅修/国外学习/非本专业课程不计入 GPA"
      }),
      expect.objectContaining({
        term: "2023-2024 春",
        name: "大学物理实验(理工)I",
        credit: "1",
        score: "95",
        rawGrade: "优",
        isGpaEligible: true
      }),
      expect.objectContaining({
        term: "2022-2023 秋",
        name: "工业系统认识1",
        credit: "0.5",
        score: "0",
        rawGrade: "通过",
        isGpaEligible: false,
        exclusionReason: "通过/合格类成绩不计入 GPA"
      }),
      expect.objectContaining({
        term: "2025-2026 春",
        name: "IT新技术讲座（校企）",
        credit: "0.5",
        score: "85",
        rawGrade: "良",
        isGpaEligible: true
      })
    ]));
    expect(courses).toHaveLength(6);
    expect(courses.map((course) => course.name)).not.toContain("3.53.02.82.5");
  });
});
