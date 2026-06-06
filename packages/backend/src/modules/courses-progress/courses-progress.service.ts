import type {
  CategoryProgress,
  CompletedPlanCourse,
  CoursesProgressEmptyReason,
  CoursesProgressResponse,
  IgnoredRuleProgress,
  MatchedFreeCourse,
  OverallProgress,
  PlanCourseRef,
  RuleProgress,
  RuleStatus,
  RuleTargetType
} from "./courses-progress.types.js";
import type {
  CoursesProgressData,
  CoursesProgressRepository,
  GpaCourseRow,
  PlanCourseGroupRow,
  PlanCourseRow
} from "./courses-progress.repository.js";

const UNCATEGORIZED = "未分类";

function toNumber(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function deriveStatus(earned: number, required: number, done: boolean): RuleStatus {
  if (done) return "completed";
  if (earned <= 0) return "not_started";
  void required;
  return "in_progress";
}

interface RuleComputation {
  status: RuleStatus;
  targetType: RuleTargetType;
  targetCourses: number | null;
  targetCredits: string | null;
  gapText: string;
}

function computeRule(
  group: PlanCourseGroupRow,
  planCoursesInGroup: PlanCourseRow[],
  earnedCourses: number,
  earnedCredits: number
): RuleComputation {
  const minCourses = group.minCourses === null ? null : toNumber(group.minCourses);
  const minCredits = group.minCredits === null ? null : toNumber(group.minCredits);
  const requirementType = group.requirementType;

  if (requirementType === "required") {
    const target = planCoursesInGroup.length;
    const done = target === 0 ? true : earnedCourses >= target;
    return {
      status: deriveStatus(earnedCourses, target, done),
      targetType: "all_courses",
      targetCourses: target,
      targetCredits: null,
      gapText: done ? "已完成" : `差 ${target - earnedCourses} 门`
    };
  }

  if (minCourses !== null && minCredits !== null) {
    const done = earnedCourses >= minCourses || earnedCredits >= minCredits;
    const gapText = done
      ? "已完成"
      : `差 ${Math.max(0, minCourses - earnedCourses)} 门或 ${round2(Math.max(0, minCredits - earnedCredits))} 学分`;
    return {
      status: deriveStatus(earnedCourses, minCourses, done),
      targetType: "either",
      targetCourses: minCourses,
      targetCredits: round2(minCredits),
      gapText
    };
  }

  if (minCredits !== null) {
    const done = earnedCredits >= minCredits;
    return {
      status: deriveStatus(earnedCourses, 1, done),
      targetType: "credits",
      targetCourses: null,
      targetCredits: round2(minCredits),
      gapText: done ? "已完成" : `差 ${round2(Math.max(0, minCredits - earnedCredits))} 学分`
    };
  }

  if (minCourses !== null) {
    const done = earnedCourses >= minCourses;
    return {
      status: deriveStatus(earnedCourses, minCourses, done),
      targetType: "courses",
      targetCourses: minCourses,
      targetCredits: null,
      gapText: done ? "已完成" : `差 ${minCourses - earnedCourses} 门`
    };
  }

  if (requirementType === "choose_one_of") {
    const done = earnedCourses >= 1;
    return {
      status: deriveStatus(earnedCourses, 1, done),
      targetType: "courses",
      targetCourses: 1,
      targetCredits: null,
      gapText: done ? "已完成" : "差 1 门"
    };
  }

  return {
    status: earnedCourses > 0 ? "in_progress" : "not_started",
    targetType: "manual",
    targetCourses: null,
    targetCredits: null,
    gapText: "未配置目标"
  };
}

function toCourseRef(course: PlanCourseRow): PlanCourseRef {
  return { id: course.id, code: course.code, name: course.name, credits: course.credits };
}

function toCompletedCourse(course: PlanCourseRow, match: GpaCourseRow): CompletedPlanCourse {
  return {
    ...toCourseRef(course),
    matchedGpaCourseId: match.id,
    matchedGpaCourseTerm: match.term,
    matchedGpaCourseScore: match.score
  };
}

function pickEmptyReason(data: CoursesProgressData): CoursesProgressEmptyReason | null {
  if (!data.plan) return "no_plan";
  if (data.gpaCourses.length === 0) return "no_gpa_courses";
  if (data.matches.length === 0) return "no_matches";
  return null;
}

export function computeCoursesProgress(data: CoursesProgressData): CoursesProgressResponse {
  if (!data.plan) {
    return {
      plan: null,
      emptyReason: "no_plan",
      overall: null,
      categories: [],
      rules: [],
      ignoredRules: []
    };
  }

  const planSummary = {
    id: data.plan.id,
    school: data.plan.school,
    college: data.plan.college,
    major: data.plan.major,
    grade: data.plan.grade
  };

  const gpaCourseById = new Map(data.gpaCourses.map((course) => [course.id, course]));

  const planCoursesByGroup = new Map<string, PlanCourseRow[]>();
  for (const course of data.planCourses) {
    if (!course.groupId) continue;
    const list = planCoursesByGroup.get(course.groupId) ?? [];
    list.push(course);
    planCoursesByGroup.set(course.groupId, list);
  }

  const matchedGpaByPlanCourseId = new Map<string, GpaCourseRow>();
  const matchedGpaByGroupId = new Map<string, GpaCourseRow[]>();

  let totalEarnedCredits = 0;
  for (const match of data.matches) {
    const gpaCourse = gpaCourseById.get(match.gpaCourseId);
    if (!gpaCourse) continue;
    totalEarnedCredits += toNumber(gpaCourse.credit);

    if (match.matchTargetType === "course" && match.programPlanCourseId) {
      matchedGpaByPlanCourseId.set(match.programPlanCourseId, gpaCourse);
      continue;
    }

    if (match.matchTargetType === "group" && match.programPlanCourseGroupId) {
      const list = matchedGpaByGroupId.get(match.programPlanCourseGroupId) ?? [];
      list.push(gpaCourse);
      matchedGpaByGroupId.set(match.programPlanCourseGroupId, list);
    }
  }

  const totalCredits = data.plan.totalCredits
    ? toNumber(data.plan.totalCredits)
    : data.planCourses.reduce((sum, course) => sum + toNumber(course.credits), 0);

  const gapCredits = Math.max(0, totalCredits - totalEarnedCredits);

  const categoriesMap = new Map<string, { required: number; earned: number; completedCount: number; totalCount: number }>();
  for (const course of data.planCourses) {
    const key = course.category ?? UNCATEGORIZED;
    const bucket = categoriesMap.get(key) ?? { required: 0, earned: 0, completedCount: 0, totalCount: 0 };
    bucket.required += toNumber(course.credits);
    bucket.totalCount += 1;
    const matched = matchedGpaByPlanCourseId.get(course.id);
    if (matched) {
      bucket.earned += toNumber(matched.credit);
      bucket.completedCount += 1;
    }
    categoriesMap.set(key, bucket);
  }

  const categories: CategoryProgress[] = [...categoriesMap.entries()]
    .sort((left, right) => right[1].required - left[1].required)
    .map(([name, bucket]) => ({
      name,
      requiredCredits: round2(bucket.required),
      earnedCredits: round2(bucket.earned),
      completedCourseCount: bucket.completedCount,
      totalCourseCount: bucket.totalCount,
      percent: safePercent(bucket.earned, bucket.required)
    }));

  const ignoredGroupIdSet = new Set(data.ignoredGroupIds);
  const ignoredRules: IgnoredRuleProgress[] = [];
  const visibleGroups: PlanCourseGroupRow[] = [];
  for (const group of data.planGroups) {
    if (ignoredGroupIdSet.has(group.id)) {
      ignoredRules.push({ id: group.id, name: group.name, requirementType: group.requirementType });
    } else {
      visibleGroups.push(group);
    }
  }
  ignoredRules.sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"));

  const rules: RuleProgress[] = visibleGroups.map((group) => {
    const planCoursesInGroup = planCoursesByGroup.get(group.id) ?? [];
    const directGroupMatches = matchedGpaByGroupId.get(group.id) ?? [];

    const completedCourses: CompletedPlanCourse[] = [];
    let courseMatchEarnedCredits = 0;
    for (const planCourse of planCoursesInGroup) {
      const matched = matchedGpaByPlanCourseId.get(planCourse.id);
      if (matched) {
        completedCourses.push(toCompletedCourse(planCourse, matched));
        courseMatchEarnedCredits += toNumber(matched.credit);
      }
    }

    const matchedFreeCourses: MatchedFreeCourse[] = directGroupMatches.map((gpaCourse) => ({
      gpaCourseId: gpaCourse.id,
      name: gpaCourse.name,
      credits: gpaCourse.credit,
      term: gpaCourse.term,
      score: gpaCourse.score
    }));

    const earnedCourses = completedCourses.length + matchedFreeCourses.length;
    const earnedCredits =
      courseMatchEarnedCredits + directGroupMatches.reduce((sum, gpaCourse) => sum + toNumber(gpaCourse.credit), 0);

    const rule = computeRule(group, planCoursesInGroup, earnedCourses, earnedCredits);

    const matchedPlanCourseIds = new Set(completedCourses.map((course) => course.id));
    const candidateCourses: PlanCourseRef[] = planCoursesInGroup
      .filter((course) => !matchedPlanCourseIds.has(course.id))
      .map(toCourseRef);

    return {
      id: group.id,
      name: group.name,
      requirementType: group.requirementType,
      description: group.description,
      status: rule.status,
      targetType: rule.targetType,
      targetCourses: rule.targetCourses,
      targetCredits: rule.targetCredits,
      earnedCourses,
      earnedCredits: round2(earnedCredits),
      gapText: rule.gapText,
      completedCourses,
      candidateCourses,
      matchedFreeCourses
    };
  });

  rules.sort((left, right) => {
    const order: Record<RuleStatus, number> = { not_started: 0, in_progress: 1, completed: 2 };
    const diff = order[left.status] - order[right.status];
    if (diff !== 0) return diff;
    return left.name.localeCompare(right.name, "zh-Hans-CN");
  });

  const satisfiedRuleCount = rules.filter((rule) => rule.status === "completed").length;

  const overall: OverallProgress = {
    totalCredits: round2(totalCredits),
    earnedCredits: round2(totalEarnedCredits),
    gapCredits: round2(gapCredits),
    percent: safePercent(totalEarnedCredits, totalCredits),
    satisfiedRuleCount,
    totalRuleCount: rules.length
  };

  return {
    plan: planSummary,
    emptyReason: pickEmptyReason(data),
    overall,
    categories,
    rules,
    ignoredRules
  };
}

export async function getCoursesProgress(
  repository: CoursesProgressRepository,
  userId: string
): Promise<CoursesProgressResponse> {
  const data = await repository.loadProgressData(userId);
  return computeCoursesProgress(data);
}
