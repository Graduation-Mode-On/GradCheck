import type { CoursesProgressRepository } from "../courses-progress/courses-progress.repository.js";
import { computeCoursesProgress } from "../courses-progress/courses-progress.service.js";
import type { CustomRequirementRepository } from "../custom-requirements/custom-requirement.repository.js";
import type { GpaRepository } from "../gpa/gpa.repository.js";
import { calculateGpaResult } from "../gpa/gpa.calculator.js";
import type { LecturePracticeRepository } from "../lecture-practice/lecture-practice.repository.js";
import type { SrtpRepository } from "../srtp/srtp.repository.js";
import { summarizeSrtp } from "../srtp/srtp.service.js";
import type { VolunteerLaborRepository } from "../volunteer-labor/volunteer-labor.repository.js";
import type {
  DimensionProgress,
  DimensionStatus,
  GraduationSummaryResponse
} from "./home-summary.types.js";

export const HUMAN_LECTURE_TARGET = 8;
export const BOOK_REPORT_TARGET = 2;
export const SOCIAL_PRACTICE_CREDITS_TARGET = 1;
export const SOCIAL_PRACTICE_COURSES_TARGET = 1;
export const VOLUNTEER_HOURS_TARGET = 12;
export const ORDINARY_LABOR_TARGET = 2;
export const SPECIAL_LABOR_TARGET = 1;
export const GPA_TARGET = 2.0;
export const SRTP_PASSING_CREDITS = 2;

export interface HomeSummaryDependencies {
  coursesProgressRepository: CoursesProgressRepository;
  gpaRepository: GpaRepository;
  lecturePracticeRepository: LecturePracticeRepository;
  volunteerLaborRepository: VolunteerLaborRepository;
  srtpRepository: SrtpRepository;
  customRequirementRepository: CustomRequirementRepository;
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function deriveStatus(current: number, target: number): DimensionStatus {
  if (target <= 0) return "unknown";
  if (current >= target) return "completed";
  if (current <= 0) return "not_started";
  return "in_progress";
}

function buildCountDimension(args: {
  key: DimensionProgress["key"];
  label: string;
  current: number;
  target: number;
  unit: string;
  route: string;
}): DimensionProgress {
  const { key, label, current, target, unit, route } = args;
  const status = deriveStatus(current, target);
  return {
    key,
    id: key,
    label,
    status,
    current,
    target,
    unit,
    percent: safePercent(current, target),
    route,
    detail:
      status === "completed"
        ? `已完成（${current}/${target} ${unit}）`
        : `${current} / ${target} ${unit}`
  };
}

export async function getGraduationSummary(
  deps: HomeSummaryDependencies,
  userId: string
): Promise<GraduationSummaryResponse> {
  const [coursesData, gpaCourses, lecture, volunteer, srtpRecords, customRequirements] =
    await Promise.all([
      deps.coursesProgressRepository.loadProgressData(userId),
      deps.gpaRepository.listCourses(userId),
      deps.lecturePracticeRepository.getProgress(userId),
      deps.volunteerLaborRepository.getProgress(userId),
      deps.srtpRepository.listRecords(userId),
      deps.customRequirementRepository.listByUserId(userId)
    ]);

  const dimensions: DimensionProgress[] = [];

  const coursesProgress = computeCoursesProgress(coursesData);
  const coursesPercent = coursesProgress.overall?.percent ?? 0;
  const coursesEarned = Number(coursesProgress.overall?.earnedCredits ?? "0");
  const coursesTotal = Number(coursesProgress.overall?.totalCredits ?? "0");
  const coursesStatus: DimensionStatus = coursesProgress.overall
    ? coursesProgress.overall.satisfiedRuleCount === coursesProgress.overall.totalRuleCount &&
      coursesProgress.overall.totalRuleCount > 0
      ? "completed"
      : coursesEarned <= 0
        ? "not_started"
        : "in_progress"
    : "not_started";
  dimensions.push({
    key: "courses",
    id: "courses",
    label: "培养方案课程",
    status: coursesStatus,
    current: coursesEarned,
    target: coursesTotal,
    unit: "学分",
    percent: coursesPercent,
    route: "/courses",
    detail: coursesProgress.overall
      ? `${coursesProgress.overall.satisfiedRuleCount}/${coursesProgress.overall.totalRuleCount} 条规则 · ${coursesEarned}/${coursesTotal} 学分`
      : "尚未导入培养方案"
  });

  const gpa = calculateGpaResult(gpaCourses).requiredFirstAttempt.weightedGpa;
  const gpaCurrent = gpa ?? 0;
  const gpaStatus: DimensionStatus =
    gpa === null ? "not_started" : gpa >= GPA_TARGET ? "completed" : "in_progress";
  dimensions.push({
    key: "gpa",
    id: "gpa",
    label: "GPA",
    status: gpaStatus,
    current: gpaCurrent,
    target: GPA_TARGET,
    unit: "",
    percent: safePercent(gpaCurrent, GPA_TARGET),
    route: "/gpa",
    detail:
      gpa === null ? "暂无成绩" : `当前 ${gpa.toFixed(2)} · 需 ≥ ${GPA_TARGET.toFixed(1)}`
  });

  dimensions.push(
    buildCountDimension({
      key: "human_lecture",
      label: "人文讲座",
      current: lecture.humanLectureCount,
      target: HUMAN_LECTURE_TARGET,
      unit: "次",
      route: "/lecture-practice"
    })
  );
  dimensions.push(
    buildCountDimension({
      key: "book_report",
      label: "读书报告",
      current: lecture.bookReportCount,
      target: BOOK_REPORT_TARGET,
      unit: "篇",
      route: "/lecture-practice"
    })
  );
  dimensions.push(
    buildCountDimension({
      key: "social_practice_credits",
      label: "社会实践学分",
      current: Number(lecture.socialPracticeCredits),
      target: SOCIAL_PRACTICE_CREDITS_TARGET,
      unit: "学分",
      route: "/lecture-practice"
    })
  );
  dimensions.push(
    buildCountDimension({
      key: "social_practice_courses",
      label: "社会实践课程",
      current: lecture.socialPracticeCourseCount,
      target: SOCIAL_PRACTICE_COURSES_TARGET,
      unit: "门",
      route: "/lecture-practice"
    })
  );

  dimensions.push(
    buildCountDimension({
      key: "volunteer_hours",
      label: "志愿服务",
      current: Number(volunteer.volunteerHours),
      target: VOLUNTEER_HOURS_TARGET,
      unit: "小时",
      route: "/volunteer"
    })
  );
  dimensions.push(
    buildCountDimension({
      key: "ordinary_labor",
      label: "普通劳动",
      current: volunteer.ordinaryLaborCount,
      target: ORDINARY_LABOR_TARGET,
      unit: "次",
      route: "/volunteer"
    })
  );
  dimensions.push(
    buildCountDimension({
      key: "special_labor",
      label: "专项劳动",
      current: volunteer.specialLaborCount,
      target: SPECIAL_LABOR_TARGET,
      unit: "次",
      route: "/volunteer"
    })
  );

  const srtpSummary = summarizeSrtp(srtpRecords);
  const srtpCurrent = Number(srtpSummary.totalCredits);
  const srtpStatus: DimensionStatus =
    srtpSummary.status === "not_passing"
      ? srtpCurrent <= 0
        ? "not_started"
        : "in_progress"
      : "completed";
  dimensions.push({
    key: "srtp",
    id: "srtp",
    label: "SRTP",
    status: srtpStatus,
    current: srtpCurrent,
    target: SRTP_PASSING_CREDITS,
    unit: "学分",
    percent: safePercent(srtpCurrent, SRTP_PASSING_CREDITS),
    route: "/srtp",
    detail:
      srtpSummary.status === "excellent"
        ? `优秀（${srtpSummary.totalCredits} 学分）`
        : srtpSummary.status === "passing"
          ? `通过（${srtpSummary.totalCredits} 学分）`
          : `${srtpSummary.totalCredits} / ${SRTP_PASSING_CREDITS.toFixed(2)} 学分`
  });

  for (const requirement of customRequirements) {
    if (!requirement.includeInProgress) continue;
    const current = Number(requirement.currentValue);
    const target = Number(requirement.targetValue);
    const status: DimensionStatus =
      requirement.status === "completed"
        ? "completed"
        : requirement.status === "in_progress"
          ? "in_progress"
          : requirement.status === "pending_confirmation"
            ? "in_progress"
            : "not_started";
    dimensions.push({
      key: "custom_requirement",
      id: `custom:${requirement.id}`,
      label: requirement.name,
      status,
      current,
      target,
      unit: requirement.unit,
      percent: requirement.progressPercent,
      route: "/custom-requirements",
      detail:
        status === "completed"
          ? `已完成（${requirement.currentValue} ${requirement.unit}）`
          : `${requirement.currentValue} / ${requirement.targetValue} ${requirement.unit}`
    });
  }

  const completedDimensions = dimensions.filter((d) => d.status === "completed").length;
  const unfinishedCount = dimensions.length - completedDimensions;

  return {
    overall: {
      coursesPercent,
      completedDimensions,
      totalDimensions: dimensions.length,
      unfinishedCount
    },
    dimensions
  };
}
