import { describe, expect, it } from "vitest";

import type { CoursesProgressData, CoursesProgressRepository } from "../courses-progress/courses-progress.repository.js";
import type { CustomRequirementRepository } from "../custom-requirements/custom-requirement.repository.js";
import type { CustomRequirementDto } from "../custom-requirements/custom-requirement.types.js";
import type { GpaRepository } from "../gpa/gpa.repository.js";
import type { GpaCourse } from "../gpa/gpa.types.js";
import type { LecturePracticeRepository } from "../lecture-practice/lecture-practice.repository.js";
import type { LecturePracticeProgress } from "../lecture-practice/lecture-practice.schemas.js";
import { defaultLecturePracticeProgress } from "../lecture-practice/lecture-practice.schemas.js";
import type { SrtpRepository } from "../srtp/srtp.repository.js";
import type { SrtpRecord } from "../srtp/srtp.schemas.js";
import type { VolunteerLaborRepository } from "../volunteer-labor/volunteer-labor.repository.js";
import type { VolunteerLaborProgress } from "../volunteer-labor/volunteer-labor.schemas.js";
import { defaultVolunteerLaborProgress } from "../volunteer-labor/volunteer-labor.schemas.js";

import { getGraduationSummary } from "./home-summary.service.js";

const userId = "user-1";

function emptyCoursesData(): CoursesProgressData {
  return {
    plan: null,
    planCourses: [],
    planGroups: [],
    gpaCourses: [],
    matches: [],
    ignoredGroupIds: []
  };
}

function fakeCoursesRepo(data: CoursesProgressData = emptyCoursesData()): CoursesProgressRepository {
  return {
    loadProgressData: async () => data,
    ignoreGroup: async () => {},
    unignoreGroup: async () => {}
  };
}

function fakeGpaRepo(courses: GpaCourse[] = []): GpaRepository {
  return {
    listCourses: async () => courses,
    createCourse: async () => courses[0],
    updateCourse: async () => null,
    deleteCourse: async () => false,
    listCourseMatches: async () => ({ matches: [], unmatchedFreeCourses: [], unmatchedRequiredCourses: [] }),
    upsertManualCourseMatch: async () => null,
    deleteCourseMatch: async () => false,
    persistResult: async () => undefined,
    getPersistedResult: async () => null
  } as unknown as GpaRepository;
}

function fakeLectureRepo(progress?: Partial<LecturePracticeProgress>): LecturePracticeRepository {
  const base = defaultLecturePracticeProgress(userId);
  const merged: LecturePracticeProgress = { ...base, ...(progress ?? {}) };
  return {
    getProgress: async () => merged,
    upsertProgress: async () => merged
  };
}

function fakeVolunteerRepo(progress?: Partial<VolunteerLaborProgress>): VolunteerLaborRepository {
  const base = defaultVolunteerLaborProgress(userId);
  const merged: VolunteerLaborProgress = { ...base, ...(progress ?? {}) };
  return {
    getProgress: async () => merged,
    upsertProgress: async () => merged
  };
}

function fakeSrtpRepo(records: SrtpRecord[] = []): SrtpRepository {
  return {
    listRecords: async () => records,
    createRecord: async () => records[0],
    updateRecord: async () => null,
    deleteRecord: async () => false
  } as unknown as SrtpRepository;
}

function fakeCustomRepo(items: CustomRequirementDto[] = []): CustomRequirementRepository {
  return {
    listByUserId: async () => items,
    create: async () => items[0],
    update: async () => null,
    delete: async () => false
  };
}

function makeDeps(overrides: Partial<Parameters<typeof getGraduationSummary>[0]> = {}) {
  return {
    coursesProgressRepository: fakeCoursesRepo(),
    gpaRepository: fakeGpaRepo(),
    lecturePracticeRepository: fakeLectureRepo(),
    volunteerLaborRepository: fakeVolunteerRepo(),
    srtpRepository: fakeSrtpRepo(),
    customRequirementRepository: fakeCustomRepo(),
    ...overrides
  };
}

describe("getGraduationSummary", () => {
  it("returns 10 base dimensions all not_started when user has no data", async () => {
    const summary = await getGraduationSummary(makeDeps(), userId);

    expect(summary.dimensions).toHaveLength(10);
    expect(summary.overall.totalDimensions).toBe(10);
    expect(summary.overall.completedDimensions).toBe(0);
    expect(summary.overall.unfinishedCount).toBe(10);
    expect(summary.overall.coursesPercent).toBe(0);

    const courses = summary.dimensions.find((d) => d.key === "courses");
    expect(courses?.status).toBe("not_started");
    expect(courses?.detail).toContain("尚未导入培养方案");

    const gpa = summary.dimensions.find((d) => d.key === "gpa");
    expect(gpa?.status).toBe("not_started");
    expect(gpa?.target).toBe(2.0);
  });

  it("marks GPA completed at the 2.0 threshold and in_progress just below", async () => {
    const baseCourse = {
      id: "c1",
      userId,
      term: "2024-spring",
      name: "Math",
      credit: "3.00",
      score: "70",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies GpaCourse;

    const summaryPass = await getGraduationSummary(makeDeps({ gpaRepository: fakeGpaRepo([baseCourse]) }), userId);
    const gpaPass = summaryPass.dimensions.find((d) => d.key === "gpa");
    expect(gpaPass?.current).toBeGreaterThanOrEqual(2.0);
    expect(gpaPass?.status).toBe("completed");

    const lowCourse: GpaCourse = { ...baseCourse, score: "65" };
    const summaryLow = await getGraduationSummary(makeDeps({ gpaRepository: fakeGpaRepo([lowCourse]) }), userId);
    const gpaLow = summaryLow.dimensions.find((d) => d.key === "gpa");
    expect(gpaLow?.current).toBeLessThan(2.0);
    expect(gpaLow?.status).toBe("in_progress");
  });

  it("derives lecture/volunteer/srtp status from current vs target", async () => {
    const summary = await getGraduationSummary(
      makeDeps({
        lecturePracticeRepository: fakeLectureRepo({
          humanLectureCount: 8,
          bookReportCount: 1,
          socialPracticeCredits: "1.00",
          socialPracticeCourseCount: 0
        }),
        volunteerLaborRepository: fakeVolunteerRepo({
          volunteerHours: "12.00",
          ordinaryLaborCount: 1,
          specialLaborCount: 1
        }),
        srtpRepository: fakeSrtpRepo([
          {
            id: "s1",
            userId,
            title: "项目",
            type: "project",
            credits: "2.00",
            description: "",
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ])
      }),
      userId
    );

    const byKey = Object.fromEntries(summary.dimensions.map((d) => [d.key, d]));
    expect(byKey.human_lecture.status).toBe("completed");
    expect(byKey.book_report.status).toBe("in_progress");
    expect(byKey.social_practice_credits.status).toBe("completed");
    expect(byKey.social_practice_courses.status).toBe("not_started");
    expect(byKey.volunteer_hours.status).toBe("completed");
    expect(byKey.ordinary_labor.status).toBe("in_progress");
    expect(byKey.special_labor.status).toBe("completed");
    expect(byKey.srtp.status).toBe("completed");
  });

  it("includes only custom requirements with includeInProgress=true", async () => {
    const requirements: CustomRequirementDto[] = [
      {
        id: "r1",
        userId,
        name: "院特色 A",
        kind: "count",
        category: "college",
        targetValue: "3",
        currentValue: "3",
        unit: "次",
        importance: "required",
        source: "college_requirement",
        includeInProgress: true,
        showOnHome: true,
        deadline: null,
        notes: null,
        status: "completed",
        progressPercent: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "r2",
        userId,
        name: "个人目标",
        kind: "count",
        category: "other",
        targetValue: "5",
        currentValue: "1",
        unit: "次",
        importance: "personal_goal",
        source: "user_custom",
        includeInProgress: false,
        showOnHome: false,
        deadline: null,
        notes: null,
        status: "in_progress",
        progressPercent: 20,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const summary = await getGraduationSummary(
      makeDeps({ customRequirementRepository: fakeCustomRepo(requirements) }),
      userId
    );

    const customs = summary.dimensions.filter((d) => d.key === "custom_requirement");
    expect(customs).toHaveLength(1);
    expect(customs[0].id).toBe("custom:r1");
    expect(customs[0].status).toBe("completed");
    expect(summary.overall.totalDimensions).toBe(11);
    expect(summary.overall.completedDimensions).toBe(1);
  });

  it("counts overall completed dimensions and unfinished correctly", async () => {
    const summary = await getGraduationSummary(
      makeDeps({
        lecturePracticeRepository: fakeLectureRepo({
          humanLectureCount: 8,
          bookReportCount: 2,
          socialPracticeCredits: "1.00",
          socialPracticeCourseCount: 1
        })
      }),
      userId
    );

    expect(summary.overall.completedDimensions).toBe(4);
    expect(summary.overall.unfinishedCount).toBe(6);
  });
});
