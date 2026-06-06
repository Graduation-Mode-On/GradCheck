import type { RecommendationPreferences } from "./course-recommendations.schemas.js";
import type { CourseConflictDto, RecommendedCourseDto, ScheduleSlot } from "./course-recommendations.types.js";

function toRecommendedCourseDto(course: AvailableSemesterCourse | RankedCourse): RecommendedCourseDto {
  return {
    courseCode: course.courseCode ?? undefined,
    courseName: course.courseName,
    credits: course.credits,
    teacher: course.teacher ?? undefined,
    classroom: course.classroom ?? undefined,
    schedule: course.schedule,
    reason: ""
  };
}

function buildConflictId(incoming: AvailableSemesterCourse, existing: AvailableSemesterCourse[]): string {
  const existingKey = existing
    .map((c) => c.courseName)
    .sort()
    .join("|");
  return `${incoming.courseName}::${existingKey}`;
}

export interface RecommendationCandidate {
  code: string;
  name: string;
  credits: number;
  category: string | null;
  subcategory: string | null;
  isRequired: boolean;
}

export interface AvailableSemesterCourse {
  courseName: string;
  courseCode: string | null;
  credits: number;
  teacher: string | null;
  classroom: string | null;
  schedule: ScheduleSlot[];
  category?: string | null;
}

export interface DeterministicRecommendationResult {
  recommendedCourses: RecommendedCourseDto[];
  totalCredits: number;
  courseCount: number;
  summary: string;
  warnings: string[];
  conflicts: CourseConflictDto[];
}

interface RankedCourse extends AvailableSemesterCourse {
  candidate?: RecommendationCandidate;
  isRequired: boolean;
  avoidDayCount: number;
  earlyMorningCount: number;
  totalPeriods: number;
  matchedCandidate: boolean;
  sourceIndex: number;
}

function normalizePreferences(preferences: RecommendationPreferences): RecommendationPreferences {
  const scheduleStyle = preferences.scheduleStyle === "balanced"
    ? "spread"
    : preferences.scheduleStyle ?? "spread";
  return {
    avoidDays: preferences.avoidDays ?? [],
    avoidEarlyMorning: preferences.avoidEarlyMorning ?? false,
    scheduleStyle,
    maxCoursesPerDay: preferences.maxCoursesPerDay,
    notes: preferences.notes
  };
}

function normalizeCourseName(value: string): string {
  return value
    .trim()
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function formatSchedule(schedule: ScheduleSlot[]): string {
  const dayNames = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return schedule
    .map((slot) => {
      const week = slot.weekLabel ?? (slot.startWeek && slot.endWeek ? `${slot.startWeek}-${slot.endWeek}周` : "");
      return `${week ? `${week} ` : ""}${dayNames[slot.dayOfWeek] ?? `周${slot.dayOfWeek}`} ${slot.startPeriod}-${slot.endPeriod}节`;
    })
    .join("，");
}

function slotWeeksOverlap(left: ScheduleSlot, right: ScheduleSlot): boolean {
  const leftStart = left.startWeek ?? 1;
  const leftEnd = left.endWeek ?? 30;
  const rightStart = right.startWeek ?? 1;
  const rightEnd = right.endWeek ?? 30;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function slotsConflict(left: ScheduleSlot, right: ScheduleSlot): boolean {
  if (left.dayOfWeek !== right.dayOfWeek) return false;
  const periodsOverlap = left.startPeriod <= right.endPeriod && right.startPeriod <= left.endPeriod;
  return periodsOverlap && slotWeeksOverlap(left, right);
}

function coursesConflict(left: AvailableSemesterCourse, right: AvailableSemesterCourse): boolean {
  return left.schedule.some((leftSlot) => right.schedule.some((rightSlot) => slotsConflict(leftSlot, rightSlot)));
}

function getCourseDaySet(course: AvailableSemesterCourse): Set<number> {
  return new Set(course.schedule.map((slot) => slot.dayOfWeek));
}

function getSelectedDayCounts(selected: AvailableSemesterCourse[]): Map<number, number> {
  const dayCounts = new Map<number, number>();
  for (const course of selected) {
    for (const day of getCourseDaySet(course)) {
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
  }
  return dayCounts;
}

function wouldExceedDailyLimit(
  selected: AvailableSemesterCourse[],
  candidate: AvailableSemesterCourse,
  maxCoursesPerDay: number | undefined
): boolean {
  if (!maxCoursesPerDay) return false;
  const dayCounts = getSelectedDayCounts(selected);
  for (const day of getCourseDaySet(candidate)) {
    if ((dayCounts.get(day) ?? 0) + 1 > maxCoursesPerDay) {
      return true;
    }
  }
  return false;
}

function getExceededLimitDays(
  selected: AvailableSemesterCourse[],
  candidate: AvailableSemesterCourse,
  maxCoursesPerDay: number | undefined
): number[] {
  if (!maxCoursesPerDay) return [];
  const dayCounts = getSelectedDayCounts(selected);

  const exceeded: number[] = [];
  for (const day of getCourseDaySet(candidate)) {
    if ((dayCounts.get(day) ?? 0) + 1 > maxCoursesPerDay) {
      exceeded.push(day);
    }
  }
  return exceeded;
}

function rankCourses(
  candidates: RecommendationCandidate[],
  semesterCourses: AvailableSemesterCourse[],
  preferences: RecommendationPreferences
): RankedCourse[] {
  const candidateByName = new Map(candidates.map((candidate) => [normalizeCourseName(candidate.name), candidate]));
  const ranked = semesterCourses.map((course, sourceIndex): RankedCourse => {
    const candidate = candidateByName.get(normalizeCourseName(course.courseName));
    const avoidDayCount = course.schedule.filter((slot) => preferences.avoidDays.includes(slot.dayOfWeek)).length;
    const earlyMorningCount = course.schedule.filter((slot) => slot.startPeriod <= 2).length;
    const totalPeriods = course.schedule.reduce(
      (sum, slot) => sum + Math.max(0, slot.endPeriod - slot.startPeriod + 1),
      0
    );

    return {
      ...course,
      candidate,
      isRequired: Boolean(candidate?.isRequired) || /必修/.test(course.category ?? ""),
      avoidDayCount,
      earlyMorningCount,
      totalPeriods,
      matchedCandidate: Boolean(candidate),
      sourceIndex
    };
  });

  const matched = ranked.filter((course) => course.matchedCandidate);
  const source = matched.length > 0 ? matched : ranked;
  return source.sort((left, right) => {
    if (left.isRequired !== right.isRequired) return left.isRequired ? -1 : 1;
    if (left.avoidDayCount !== right.avoidDayCount) return left.avoidDayCount - right.avoidDayCount;
    if (preferences.avoidEarlyMorning && left.earlyMorningCount !== right.earlyMorningCount) {
      return left.earlyMorningCount - right.earlyMorningCount;
    }
    if (left.candidate && right.candidate && left.candidate.credits !== right.candidate.credits) {
      return right.candidate.credits - left.candidate.credits;
    }
    if (left.credits !== right.credits) return right.credits - left.credits;
    if (left.totalPeriods !== right.totalPeriods) return left.totalPeriods - right.totalPeriods;
    const nameOrder = left.courseName.localeCompare(right.courseName, "zh-Hans-CN");
    return nameOrder === 0 ? left.sourceIndex - right.sourceIndex : nameOrder;
  });
}

function getScheduleStyleScore(
  selected: AvailableSemesterCourse[],
  course: AvailableSemesterCourse,
  style: RecommendationPreferences["scheduleStyle"]
): number {
  if (selected.length === 0) return 0;
  const dayCounts = getSelectedDayCounts(selected);
  const courseDays = [...getCourseDaySet(course)];
  if (style === "compact") {
    return courseDays.filter((day) => !dayCounts.has(day)).length;
  }
  return courseDays.reduce((sum, day) => sum + (dayCounts.get(day) ?? 0), 0);
}

function getPreferenceScore(
  selected: AvailableSemesterCourse[],
  course: RankedCourse,
  preferences: RecommendationPreferences
): number {
  const dayCounts = getSelectedDayCounts(selected);
  const courseDays = [...getCourseDaySet(course)];
  const sharedDayCount = courseDays.filter((day) => dayCounts.has(day)).length;
  const newDayCount = courseDays.length - sharedDayCount;
  const selectedDayWeight = courseDays.reduce((sum, day) => sum + (dayCounts.get(day) ?? 0), 0);

  let score = 0;
  if (course.isRequired) score += 100_000;
  if (course.matchedCandidate) score += 10_000;

  score += (course.candidate?.credits ?? course.credits) * 100;
  score -= course.avoidDayCount * 1_000;
  if (preferences.avoidEarlyMorning) score -= course.earlyMorningCount * 1_200;

  if (preferences.scheduleStyle === "compact") {
    score += sharedDayCount * 700 + selectedDayWeight * 180 - newDayCount * 260;
  } else {
    score += newDayCount * 700 - sharedDayCount * 360 - selectedDayWeight * 160;
  }

  score -= course.totalPeriods;
  return score;
}

function compareCoursesByPreference(
  left: RankedCourse,
  right: RankedCourse,
  selected: AvailableSemesterCourse[],
  preferences: RecommendationPreferences
): number {
  const leftScore = getPreferenceScore(selected, left, preferences);
  const rightScore = getPreferenceScore(selected, right, preferences);
  if (leftScore !== rightScore) return rightScore - leftScore;
  if (left.isRequired !== right.isRequired) return left.isRequired ? -1 : 1;
  if (left.matchedCandidate !== right.matchedCandidate) return left.matchedCandidate ? -1 : 1;
  if (left.credits !== right.credits) return right.credits - left.credits;
  if (left.totalPeriods !== right.totalPeriods) return left.totalPeriods - right.totalPeriods;
  const nameOrder = left.courseName.localeCompare(right.courseName, "zh-Hans-CN");
  return nameOrder === 0 ? left.sourceIndex - right.sourceIndex : nameOrder;
}

function sortForCurrentSelection(
  courses: RankedCourse[],
  selected: AvailableSemesterCourse[],
  preferences: RecommendationPreferences
): RankedCourse[] {
  return [...courses].sort((left, right) => compareCoursesByPreference(left, right, selected, preferences));
}

function getConflictingCourses(selected: RankedCourse[], course: RankedCourse): RankedCourse[] {
  return selected.filter((item) => coursesConflict(item, course));
}

function removeSelectedCourses(selected: RankedCourse[], coursesToRemove: RankedCourse[]): void {
  for (const course of coursesToRemove) {
    const index = selected.indexOf(course);
    if (index >= 0) selected.splice(index, 1);
  }
}

export function generateDeterministicRecommendation(
  candidates: RecommendationCandidate[],
  semesterCourses: AvailableSemesterCourse[],
  rawPreferences: RecommendationPreferences
): DeterministicRecommendationResult {
  const preferences = normalizePreferences(rawPreferences);
  const rankedCourses = rankCourses(candidates, semesterCourses, preferences);
  const selected: RankedCourse[] = [];
  const warnings: string[] = [];
  const conflictsOut: CourseConflictDto[] = [];

  if (semesterCourses.length === 0) {
    return {
      recommendedCourses: [],
      totalCredits: 0,
      courseCount: 0,
      summary: "当前学期尚未录入可选课程，无法生成推荐方案。",
      warnings: ["请先导入本学期课程数据。"],
      conflicts: []
    };
  }

  const matchedRankedCount = rankedCourses.filter((course) => course.matchedCandidate).length;
  if (matchedRankedCount === 0 && candidates.length > 0) {
    warnings.push("未找到与当前培养方案缺口同名的本学期开课课程，已按全部已录入课程生成可行方案。");
  }

  const remainingCourses = [...rankedCourses];

  while (remainingCourses.length > 0) {
    const [course] = sortForCurrentSelection(remainingCourses, selected, preferences);
    remainingCourses.splice(remainingCourses.indexOf(course), 1);

    const conflicts = getConflictingCourses(selected, course);
    if (conflicts.length > 0) {
      const baseSelected = selected.filter((item) => !conflicts.includes(item));
      const requiredConflicts = conflicts.filter((item) => item.isRequired);
      const canReplaceConflicts =
        requiredConflicts.length === 0 &&
        (
          course.isRequired ||
          conflicts.every((conflict) => (
            compareCoursesByPreference(course, conflict, baseSelected, preferences) < 0
          ))
        );

      if (!canReplaceConflicts) {
        warnings.push(
          `${course.courseName} 与 ${conflicts.map((item) => item.courseName).join("、")} 时间冲突，已按当前偏好保留后者。`
        );
        // Skip recording conflict when elective conflicts with required — the only sensible choice is keeping the required course
        if (course.isRequired || requiredConflicts.length === 0) {
          conflictsOut.push({
            id: buildConflictId(course, conflicts),
            incoming: toRecommendedCourseDto(course),
            existing: conflicts.map(toRecommendedCourseDto),
            defaultChoice: "existing",
            reason: "按当前偏好保留已选课程"
          });
        }
        continue;
      }

      const exceededAfterReplacement = getExceededLimitDays(baseSelected, course, preferences.maxCoursesPerDay);
      if (exceededAfterReplacement.length > 0 && !course.isRequired) {
        warnings.push(
          `${course.courseName} 与 ${conflicts.map((item) => item.courseName).join("、")} 时间冲突，但会超过单日课程数量上限，已保留原课程。`
        );
        conflictsOut.push({
          id: buildConflictId(course, conflicts),
          incoming: toRecommendedCourseDto(course),
          existing: conflicts.map(toRecommendedCourseDto),
          defaultChoice: "existing",
          reason: "改选后会超过单日课程数量上限"
        });
        continue;
      }

      removeSelectedCourses(selected, conflicts);
      warnings.push(
        `${course.courseName} 与 ${conflicts.map((item) => item.courseName).join("、")} 时间冲突，已按当前偏好改选 ${course.courseName}。`
      );
      conflictsOut.push({
        id: buildConflictId(course, conflicts),
        incoming: toRecommendedCourseDto(course),
        existing: conflicts.map(toRecommendedCourseDto),
        defaultChoice: "incoming",
        reason: "按当前偏好改选新课程"
      });
    }

    const exceededLimitDays = getExceededLimitDays(selected, course, preferences.maxCoursesPerDay);
    if (exceededLimitDays.length > 0 && !course.isRequired) {
      warnings.push(`${course.courseName} 会超过单日课程数量上限，已跳过。`);
      continue;
    }
    if (exceededLimitDays.length > 0 && course.isRequired) {
      warnings.push(`${course.courseName} 是必修课，已优先推荐；它会超过单日课程数量偏好。`);
    }
    if (preferences.avoidEarlyMorning && course.earlyMorningCount > 0 && course.isRequired) {
      warnings.push(`${course.courseName} 是必修课，已优先推荐；它包含早八时段。`);
    }

    selected.push(course);
  }

  const recommendedCourses = selected.map((course): RecommendedCourseDto => ({
    courseCode: course.courseCode ?? course.candidate?.code,
    courseName: course.courseName,
    credits: course.candidate?.credits ?? course.credits,
    teacher: course.teacher ?? undefined,
    classroom: course.classroom ?? undefined,
    schedule: course.schedule,
    reason: [
      course.isRequired ? "必修优先" : "匹配当前学期缺口",
      preferences.scheduleStyle === "compact" ? "倾向课程集中" : "倾向课程分散",
      preferences.avoidEarlyMorning && course.earlyMorningCount === 0 ? "避开早八" : preferences.avoidEarlyMorning ? "包含早八但优先级更高" : "未限制早八",
      `时间：${formatSchedule(course.schedule)}`
    ].join("；")
  }));

  const totalCredits = recommendedCourses.reduce((sum, course) => sum + course.credits, 0);
  const matchedCount = selected.filter((course) => course.matchedCandidate).length;

  return {
    recommendedCourses,
    totalCredits,
    courseCount: recommendedCourses.length,
    summary: `已推荐 ${recommendedCourses.length} 门课程，合计 ${totalCredits.toFixed(2)} 学分，其中 ${matchedCount} 门匹配当前培养方案缺口。`,
    warnings: [...new Set(warnings)].slice(0, 8),
    conflicts: conflictsOut
  };
}

export const __courseRecommendationEngineInternals = {
  normalizeCourseName,
  slotsConflict,
  coursesConflict,
  wouldExceedDailyLimit,
  getScheduleStyleScore,
  getPreferenceScore
};
