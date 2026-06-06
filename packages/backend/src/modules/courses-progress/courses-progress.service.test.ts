import { describe, expect, it } from "vitest";

import { computeCoursesProgress } from "./courses-progress.service.js";
import type {
  CoursesProgressData,
  GpaCourseRow,
  PlanCourseGroupRow,
  PlanCourseRow,
  CourseMatchRow,
  PlanRow
} from "./courses-progress.repository.js";

const now = new Date("2026-06-06T00:00:00.000Z");

function plan(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    id: "plan-1",
    sourceFilename: "demo.pdf",
    school: "东南大学",
    college: "软件学院",
    major: "软件工程",
    grade: "2022级",
    totalCredits: "166.00",
    courseCount: 0,
    requirementCount: 0,
    warningCount: 0,
    planJson: {} as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function planCourse(overrides: Partial<PlanCourseRow>): PlanCourseRow {
  return {
    id: "plan-course-1",
    programPlanId: "plan-1",
    groupId: null,
    sourceRequirementId: null,
    code: "C001",
    name: "课程",
    credits: "3.00",
    category: "通识教育基础课",
    subcategory: null,
    suggestedTerm: null,
    requirementType: "required",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function planGroup(overrides: Partial<PlanCourseGroupRow>): PlanCourseGroupRow {
  return {
    id: "group-1",
    programPlanId: "plan-1",
    sourceRequirementId: "req-1",
    name: "组",
    requirementType: "required",
    minCourses: null,
    minCredits: null,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function gpaCourse(overrides: Partial<GpaCourseRow>): GpaCourseRow {
  return {
    id: "gpa-1",
    userId: "user-1",
    term: "2024-2025 秋",
    name: "课程",
    credit: "3.00",
    score: "90.00",
    isRequired: true,
    isFirstAttempt: true,
    isGpaEligible: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function match(overrides: Partial<CourseMatchRow>): CourseMatchRow {
  return {
    id: "match-1",
    userId: "user-1",
    gpaCourseId: "gpa-1",
    programPlanCourseId: null,
    programPlanCourseGroupId: null,
    matchTargetType: "course",
    matchMethod: "manual",
    confidence: "1.00",
    confirmedByUser: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildData(overrides: Partial<CoursesProgressData> = {}): CoursesProgressData {
  return {
    plan: plan(),
    planCourses: [],
    planGroups: [],
    gpaCourses: [],
    matches: [],
    ignoredGroupIds: [],
    ...overrides
  };
}

describe("computeCoursesProgress", () => {
  it("returns no_plan when user has no bound program plan", () => {
    const result = computeCoursesProgress(buildData({ plan: null }));
    expect(result.plan).toBeNull();
    expect(result.emptyReason).toBe("no_plan");
    expect(result.overall).toBeNull();
    expect(result.rules).toEqual([]);
  });

  it("signals no_gpa_courses when plan is bound but no courses recorded", () => {
    const result = computeCoursesProgress(buildData());
    expect(result.emptyReason).toBe("no_gpa_courses");
    expect(result.overall?.totalCredits).toBe("166.00");
    expect(result.overall?.earnedCredits).toBe("0.00");
  });

  it("signals no_matches when GPA courses exist but none are matched", () => {
    const result = computeCoursesProgress(
      buildData({
        gpaCourses: [gpaCourse({})]
      })
    );
    expect(result.emptyReason).toBe("no_matches");
  });

  it("aggregates earned credits and category progress from course matches", () => {
    const required = planCourse({
      id: "plan-course-required",
      code: "PHY",
      name: "大学物理",
      credits: "3.00",
      category: "通识教育基础课",
      groupId: "group-required",
      requirementType: "required"
    });
    const elective = planCourse({
      id: "plan-course-elective",
      code: "ELE",
      name: "选修",
      credits: "2.00",
      category: "专业相关课程",
      groupId: "group-elective",
      requirementType: "elective"
    });
    const requiredGroup = planGroup({
      id: "group-required",
      requirementType: "required",
      name: "必修课程"
    });
    const electiveGroup = planGroup({
      id: "group-elective",
      requirementType: "choose_n_of",
      minCourses: "1",
      name: "选修任选 1 门"
    });

    const result = computeCoursesProgress(
      buildData({
        plan: plan({ totalCredits: "5.00" }),
        planCourses: [required, elective],
        planGroups: [requiredGroup, electiveGroup],
        gpaCourses: [
          gpaCourse({ id: "gpa-required", credit: "3.00", name: "大学物理" }),
          gpaCourse({ id: "gpa-elective", credit: "2.00", name: "选修" })
        ],
        matches: [
          match({ id: "m1", gpaCourseId: "gpa-required", programPlanCourseId: required.id, matchTargetType: "course" }),
          match({ id: "m2", gpaCourseId: "gpa-elective", programPlanCourseId: elective.id, matchTargetType: "course" })
        ]
      })
    );

    expect(result.emptyReason).toBeNull();
    expect(result.overall).toEqual({
      totalCredits: "5.00",
      earnedCredits: "5.00",
      gapCredits: "0.00",
      percent: 100,
      satisfiedRuleCount: 2,
      totalRuleCount: 2
    });
    expect(result.categories.map((category) => category.name)).toEqual([
      "通识教育基础课",
      "专业相关课程"
    ]);
    expect(result.categories[0]).toMatchObject({
      requiredCredits: "3.00",
      earnedCredits: "3.00",
      completedCourseCount: 1,
      totalCourseCount: 1,
      percent: 100
    });
  });

  it("computes choose_n_of progress and exposes remaining candidates when incomplete", () => {
    const candidates = [
      planCourse({ id: "p1", code: "P1", name: "实践 1", credits: "2.00", groupId: "group-practice", category: "集中实践环节", requirementType: "elective" }),
      planCourse({ id: "p2", code: "P2", name: "实践 2", credits: "2.00", groupId: "group-practice", category: "集中实践环节", requirementType: "elective" }),
      planCourse({ id: "p3", code: "P3", name: "实践 3", credits: "2.00", groupId: "group-practice", category: "集中实践环节", requirementType: "elective" })
    ];
    const group = planGroup({
      id: "group-practice",
      requirementType: "choose_n_of",
      minCourses: "3",
      name: "实践任选 3 门"
    });

    const result = computeCoursesProgress(
      buildData({
        planCourses: candidates,
        planGroups: [group],
        gpaCourses: [gpaCourse({ id: "gpa-p1", name: "实践 1", credit: "2.00" })],
        matches: [match({ id: "m", gpaCourseId: "gpa-p1", programPlanCourseId: "p1", matchTargetType: "course" })]
      })
    );

    const rule = result.rules.find((entry) => entry.id === "group-practice");
    expect(rule).toBeDefined();
    expect(rule?.status).toBe("in_progress");
    expect(rule?.earnedCourses).toBe(1);
    expect(rule?.targetCourses).toBe(3);
    expect(rule?.gapText).toBe("差 2 门");
    expect(rule?.completedCourses.map((course) => course.id)).toEqual(["p1"]);
    expect(rule?.candidateCourses.map((course) => course.id)).toEqual(["p2", "p3"]);
  });

  it("computes min_credits_from_group rule based on accumulated credits", () => {
    const courses = [
      planCourse({ id: "s1", name: "研讨课 A", credits: "4.00", groupId: "group-seminar", category: "专业相关课程", requirementType: "elective" }),
      planCourse({ id: "s2", name: "研讨课 B", credits: "4.00", groupId: "group-seminar", category: "专业相关课程", requirementType: "elective" }),
      planCourse({ id: "s3", name: "研讨课 C", credits: "4.00", groupId: "group-seminar", category: "专业相关课程", requirementType: "elective" })
    ];
    const group = planGroup({
      id: "group-seminar",
      requirementType: "min_credits_from_group",
      minCredits: "12.00",
      name: "研讨课 ≥ 12 学分"
    });

    const result = computeCoursesProgress(
      buildData({
        planCourses: courses,
        planGroups: [group],
        gpaCourses: [gpaCourse({ id: "gpa-s1", name: "研讨课 A", credit: "4.00" })],
        matches: [match({ id: "m", gpaCourseId: "gpa-s1", programPlanCourseId: "s1", matchTargetType: "course" })]
      })
    );

    const rule = result.rules.find((entry) => entry.id === "group-seminar");
    expect(rule?.status).toBe("in_progress");
    expect(rule?.targetType).toBe("credits");
    expect(rule?.targetCredits).toBe("12.00");
    expect(rule?.earnedCredits).toBe("4.00");
    expect(rule?.gapText).toBe("差 8.00 学分");
  });

  it("treats tag_credit_requirement as satisfied when courses OR credits target is reached", () => {
    const courses = [
      planCourse({ id: "e1", name: "全英文 A", credits: "3.00", groupId: "group-en", category: "专业相关课程", requirementType: "elective" }),
      planCourse({ id: "e2", name: "全英文 B", credits: "3.00", groupId: "group-en", category: "专业相关课程", requirementType: "elective" })
    ];
    const group = planGroup({
      id: "group-en",
      requirementType: "tag_credit_requirement",
      minCourses: "2",
      minCredits: "4.00",
      name: "全英文课 ≥ 2 门或 4 学分"
    });

    const result = computeCoursesProgress(
      buildData({
        planCourses: courses,
        planGroups: [group],
        gpaCourses: [gpaCourse({ id: "gpa-e1", name: "全英文 A", credit: "5.00" })],
        matches: [match({ id: "m", gpaCourseId: "gpa-e1", programPlanCourseId: "e1", matchTargetType: "course" })]
      })
    );

    const rule = result.rules.find((entry) => entry.id === "group-en");
    expect(rule?.targetType).toBe("either");
    expect(rule?.status).toBe("completed");
    expect(rule?.gapText).toBe("已完成");
  });

  it("counts direct group matches and exposes them as matchedFreeCourses", () => {
    const group = planGroup({
      id: "group-general",
      requirementType: "choose_n_of",
      minCourses: "2",
      name: "通识任选 2 门"
    });

    const result = computeCoursesProgress(
      buildData({
        planCourses: [],
        planGroups: [group],
        gpaCourses: [gpaCourse({ id: "gpa-free", name: "通识自由课", credit: "2.00" })],
        matches: [
          match({
            id: "m",
            gpaCourseId: "gpa-free",
            programPlanCourseGroupId: "group-general",
            matchTargetType: "group"
          })
        ]
      })
    );

    const rule = result.rules.find((entry) => entry.id === "group-general");
    expect(rule?.earnedCourses).toBe(1);
    expect(rule?.matchedFreeCourses).toHaveLength(1);
    expect(rule?.matchedFreeCourses[0]?.name).toBe("通识自由课");
    expect(rule?.gapText).toBe("差 1 门");
  });

  it("sorts rules by status: not_started, in_progress, then completed", () => {
    const groups: PlanCourseGroupRow[] = [
      planGroup({ id: "g-done", name: "已完成组", requirementType: "choose_one_of" }),
      planGroup({ id: "g-not", name: "未开始组", requirementType: "choose_n_of", minCourses: "2" }),
      planGroup({ id: "g-inprog", name: "进行中组", requirementType: "choose_n_of", minCourses: "3" })
    ];
    const courses = [
      planCourse({ id: "c-done", groupId: "g-done", name: "已完成课程", credits: "2.00", requirementType: "elective", category: "专业相关课程" }),
      planCourse({ id: "c-inprog", groupId: "g-inprog", name: "进行中课程", credits: "2.00", requirementType: "elective", category: "专业相关课程" })
    ];

    const result = computeCoursesProgress(
      buildData({
        planCourses: courses,
        planGroups: groups,
        gpaCourses: [
          gpaCourse({ id: "gpa-done", credit: "2.00", name: "已完成课程" }),
          gpaCourse({ id: "gpa-inprog", credit: "2.00", name: "进行中课程" })
        ],
        matches: [
          match({ id: "m1", gpaCourseId: "gpa-done", programPlanCourseId: "c-done", matchTargetType: "course" }),
          match({ id: "m2", gpaCourseId: "gpa-inprog", programPlanCourseId: "c-inprog", matchTargetType: "course" })
        ]
      })
    );

    expect(result.rules.map((rule) => rule.id)).toEqual(["g-not", "g-inprog", "g-done"]);
    expect(result.overall?.satisfiedRuleCount).toBe(1);
    expect(result.overall?.totalRuleCount).toBe(3);
  });

  it("excludes ignored groups from rules and totals but lists them under ignoredRules", () => {
    const visibleGroup = planGroup({
      id: "g-visible",
      requirementType: "choose_n_of",
      minCourses: "2",
      name: "正常规则"
    });
    const noisyGroup = planGroup({
      id: "g-noisy",
      requirementType: "choose_n_of",
      minCourses: "1",
      name: "误识别规则"
    });

    const result = computeCoursesProgress(
      buildData({
        planGroups: [visibleGroup, noisyGroup],
        ignoredGroupIds: ["g-noisy"]
      })
    );

    expect(result.rules.map((rule) => rule.id)).toEqual(["g-visible"]);
    expect(result.ignoredRules).toEqual([
      { id: "g-noisy", name: "误识别规则", requirementType: "choose_n_of" }
    ]);
    expect(result.overall?.totalRuleCount).toBe(1);
  });
});
