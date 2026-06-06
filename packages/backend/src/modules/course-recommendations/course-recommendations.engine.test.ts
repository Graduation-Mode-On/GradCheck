import { describe, expect, it } from "vitest";

import {
  __courseRecommendationEngineInternals,
  generateDeterministicRecommendation
} from "./course-recommendations.engine.js";

const { normalizeCourseName, slotsConflict } = __courseRecommendationEngineInternals;

describe("course recommendation engine", () => {
  it("normalizes Chinese and ASCII parentheses when matching courses", () => {
    expect(normalizeCourseName("软件智能化方法（研讨）")).toBe(normalizeCourseName("软件智能化方法(研讨)"));
  });

  it("treats overlapping periods as non-conflicting when weeks do not overlap", () => {
    expect(
      slotsConflict(
        { dayOfWeek: 2, startPeriod: 8, endPeriod: 10, startWeek: 1, endWeek: 12 },
        { dayOfWeek: 2, startPeriod: 8, endPeriod: 9, startWeek: 13, endWeek: 14 }
      )
    ).toBe(false);
  });

  it("treats overlapping weeks and periods on the same day as conflict", () => {
    expect(
      slotsConflict(
        { dayOfWeek: 5, startPeriod: 6, endPeriod: 9, startWeek: 9, endWeek: 16 },
        { dayOfWeek: 5, startPeriod: 6, endPeriod: 8, startWeek: 9, endWeek: 16 }
      )
    ).toBe(true);
  });

  it("prioritizes required matched courses and skips real schedule conflicts", () => {
    const result = generateDeterministicRecommendation(
      [
        {
          code: "REQ001",
          name: "网络与信息安全（全英文、研讨）",
          credits: 3,
          category: "专业课",
          subcategory: null,
          isRequired: true
        },
        {
          code: "ELE001",
          name: "机器视觉与应用",
          credits: 3,
          category: "专业选修",
          subcategory: null,
          isRequired: false
        }
      ],
      [
        {
          courseName: "机器视觉与应用",
          courseCode: null,
          credits: 3,
          teacher: null,
          classroom: null,
          category: "选修",
          schedule: [{ dayOfWeek: 5, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
        },
        {
          courseName: "网络与信息安全（全英文、研讨）",
          courseCode: null,
          credits: 3,
          teacher: null,
          classroom: null,
          category: "必修",
          schedule: [{ dayOfWeek: 5, startPeriod: 2, endPeriod: 5, startWeek: 12, endWeek: 14 }]
        }
      ],
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "spread" }
    );

    expect(result.recommendedCourses.map((course) => course.courseName)).toEqual([
      "网络与信息安全（全英文、研讨）"
    ]);
    expect(result.warnings.join("\n")).toContain("机器视觉与应用 与 网络与信息安全");
    // Elective vs required conflicts are silently skipped (no meaningful choice for the user)
    expect(result.conflicts).toHaveLength(0);
  });

  it("can recommend same weekday and period courses when their weeks do not overlap", () => {
    const result = generateDeterministicRecommendation(
      [],
      [
        {
          courseName: "分布式系统（全英文、研讨）A",
          courseCode: null,
          credits: 3,
          teacher: null,
          classroom: null,
          category: "研讨",
          schedule: [{ dayOfWeek: 2, startPeriod: 8, endPeriod: 10, startWeek: 1, endWeek: 12 }]
        },
        {
          courseName: "分布式系统（全英文、研讨）B",
          courseCode: null,
          credits: 3,
          teacher: null,
          classroom: null,
          category: "研讨",
          schedule: [{ dayOfWeek: 2, startPeriod: 8, endPeriod: 9, startWeek: 13, endWeek: 14 }]
        }
      ],
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "spread" }
    );

    expect(result.recommendedCourses).toHaveLength(2);
  });

  it("keeps required courses even when they exceed the daily course limit preference", () => {
    const result = generateDeterministicRecommendation(
      [
        {
          code: "REQ001",
          name: "必修一",
          credits: 2,
          category: "专业课",
          subcategory: null,
          isRequired: true
        },
        {
          code: "REQ002",
          name: "必修二",
          credits: 2,
          category: "专业课",
          subcategory: null,
          isRequired: true
        },
        {
          code: "ELE001",
          name: "选修一",
          credits: 2,
          category: "专业选修",
          subcategory: null,
          isRequired: false
        }
      ],
      [
        {
          courseName: "必修一",
          courseCode: null,
          credits: 2,
          teacher: null,
          classroom: null,
          category: "必修",
          schedule: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 }]
        },
        {
          courseName: "必修二",
          courseCode: null,
          credits: 2,
          teacher: null,
          classroom: null,
          category: "必修",
          schedule: [{ dayOfWeek: 1, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
        },
        {
          courseName: "选修一",
          courseCode: null,
          credits: 2,
          teacher: null,
          classroom: null,
          category: "选修",
          schedule: [{ dayOfWeek: 1, startPeriod: 6, endPeriod: 7, startWeek: 1, endWeek: 16 }]
        }
      ],
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "spread", maxCoursesPerDay: 1 }
    );

    expect(result.recommendedCourses.map((course) => course.courseName).sort()).toEqual(["必修一", "必修二"].sort());
    expect(result.warnings.join("\n")).toContain("必修二 是必修课，已优先推荐");
    expect(result.warnings.join("\n")).toContain("选修一 会超过单日课程数量上限");
  });

  it("prefers non-early-morning courses when avoidEarlyMorning is enabled", () => {
    const result = generateDeterministicRecommendation(
      [],
      [
        {
          courseName: "A早八课程",
          courseCode: null,
          credits: 2,
          teacher: null,
          classroom: null,
          category: "选修",
          schedule: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 }]
        },
        {
          courseName: "B上午课程",
          courseCode: null,
          credits: 2,
          teacher: null,
          classroom: null,
          category: "选修",
          schedule: [{ dayOfWeek: 2, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
        }
      ],
      { avoidDays: [], avoidEarlyMorning: true, scheduleStyle: "spread" }
    );

    expect(result.recommendedCourses.map((course) => course.courseName)).toEqual(["B上午课程", "A早八课程"]);
  });

  it("changes ordering for compact and spread schedule styles", () => {
    const courses = [
      {
        courseName: "A课程",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [{ dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 }]
      },
      {
        courseName: "B同日课程",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [{ dayOfWeek: 1, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
      },
      {
        courseName: "C隔日课程",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [{ dayOfWeek: 2, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
      }
    ];

    const compact = generateDeterministicRecommendation(
      [],
      courses,
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "compact" }
    );
    const spread = generateDeterministicRecommendation(
      [],
      courses,
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "spread" }
    );

    expect(compact.recommendedCourses.map((course) => course.courseName)).toEqual(["A课程", "B同日课程", "C隔日课程"]);
    expect(spread.recommendedCourses.map((course) => course.courseName)).toEqual(["A课程", "C隔日课程", "B同日课程"]);
  });

  it("uses compact and spread preferences when choosing between conflicting elective courses", () => {
    const courses = [
      {
        courseName: "A锚点课程",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [{ dayOfWeek: 1, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 }]
      },
      {
        courseName: "B集中方案",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [
          { dayOfWeek: 1, startPeriod: 6, endPeriod: 7, startWeek: 1, endWeek: 16 },
          { dayOfWeek: 5, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 }
        ]
      },
      {
        courseName: "C分散方案",
        courseCode: null,
        credits: 2,
        teacher: null,
        classroom: null,
        category: "选修",
        schedule: [
          { dayOfWeek: 3, startPeriod: 6, endPeriod: 7, startWeek: 1, endWeek: 16 },
          { dayOfWeek: 5, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 }
        ]
      }
    ];

    const candidates = [
      {
        code: "ANCHOR",
        name: "A锚点课程",
        credits: 2,
        category: "专业课",
        subcategory: null,
        isRequired: true
      },
      {
        code: "COMPACT",
        name: "B集中方案",
        credits: 2,
        category: "专业选修",
        subcategory: null,
        isRequired: false
      },
      {
        code: "SPREAD",
        name: "C分散方案",
        credits: 2,
        category: "专业选修",
        subcategory: null,
        isRequired: false
      }
    ];

    const compact = generateDeterministicRecommendation(
      candidates,
      courses,
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "compact" }
    );
    const spread = generateDeterministicRecommendation(
      candidates,
      courses,
      { avoidDays: [], avoidEarlyMorning: false, scheduleStyle: "spread" }
    );

    expect(compact.recommendedCourses.map((course) => course.courseName)).toEqual(["A锚点课程", "B集中方案"]);
    expect(spread.recommendedCourses.map((course) => course.courseName)).toEqual(["A锚点课程", "C分散方案"]);
    expect(compact.warnings.join("\n")).toContain("已按当前偏好保留后者");
    expect(spread.warnings.join("\n")).toContain("已按当前偏好保留后者");
    expect(compact.conflicts.length).toBeGreaterThan(0);
    expect(spread.conflicts.length).toBeGreaterThan(0);
    expect(compact.conflicts[0].defaultChoice).toBe("existing");
  });
});
