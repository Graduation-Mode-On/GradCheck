import { Router } from "express";

import { HttpError } from "../../lib/http-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { GpaRepository } from "../gpa/gpa.repository.js";
import type { ProgramPlanRepository } from "../program-plans/program-plans.repository.js";
import type { CurriculumPlan } from "../program-plans/program-plans.schemas.js";
import {
  generateRecommendationSchema,
  parseImageSchema,
  semesterCourseInputSchema
} from "./course-recommendations.schemas.js";
import type { CourseRecommendationRepository } from "./course-recommendations.repository.js";
import { parseCourseImage } from "./course-recommendations.ai.js";
import { generateDeterministicRecommendation } from "./course-recommendations.engine.js";

interface Dependencies {
  authRepository: AuthRepository;
  courseRecommendationRepository: CourseRecommendationRepository;
  programPlanRepository: ProgramPlanRepository;
  gpaRepository: GpaRepository;
}

function getRouteId(id: string | string[] | undefined): string {
  if (typeof id !== "string") {
    throw new HttpError(400, "Course id is required");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{3}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Course id must be a valid UUID");
  }
  return id;
}

function isRequiredCourse(course: {
  category?: string | null;
  subcategory?: string | null;
  required_type?: string | null;
  name?: string;
}): boolean {
  // Check explicit required_type field from some program plans
  if (course.required_type && course.required_type !== "") {
    return /必修|required|必/i.test(course.required_type);
  }
  // Check category/subcategory heuristics
  const text = `${course.category ?? ""} ${course.subcategory ?? ""} ${course.name ?? ""}`;
  return /必修|思政|体育|英语/i.test(text);
}

function inferPlanYear(userGrade: number | undefined, currentTerm: string | undefined): string | null {
  if (!userGrade || !currentTerm) return null;
  const match = currentTerm.match(/^(\d{4})-/);
  if (!match) return null;
  const startYear = parseInt(match[1], 10);
  const yearDiff = startYear - userGrade;
  const yearMap = ["一", "二", "三", "四"];
  if (yearDiff >= 0 && yearDiff < 4) {
    return yearMap[yearDiff];
  }
  return null;
}

function inferPlanSemester(currentTerm: string | undefined): string | null {
  if (!currentTerm) return null;
  const semester = currentTerm.split(/\s+/)[1];
  if (semester === "秋") return "1";
  if (semester === "春") return "3";
  return null;
}

function formatPlanTermLabel(planYear: string | null, planSemester: string | null): string | null {
  if (!planYear || !planSemester) return null;
  return `${planYear}年级第${planSemester}学期`;
}

function parseGradeYear(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
}

function resolveGradeContext(profileGrade: number | string | null | undefined, planGrade: string | null | undefined) {
  const profileGradeYear = parseGradeYear(profileGrade);
  const planGradeYear = parseGradeYear(planGrade);
  const gradeYear = profileGradeYear ?? planGradeYear;

  return {
    gradeYear,
    gradeSource: profileGradeYear ? "profile" : planGradeYear ? "program_plan" : "unknown",
    profileGradeYear: profileGradeYear ?? null,
    planGradeYear: planGradeYear ?? null
  };
}

function deriveCandidates(
  planJson: CurriculumPlan | null,
  completedCourses: Array<{ name: string }>,
  userGrade?: number,
  currentTerm?: string
): Array<{
  code: string;
  name: string;
  credits: number;
  category: string | null;
  subcategory: string | null;
  term: { year?: string | null; semester?: string | null };
  status: "completed" | "available";
  isRequired: boolean;
}> {
  if (!planJson) return [];

  const completedNames = new Set(completedCourses.map((c) => c.name.trim()));
  const planYear = inferPlanYear(userGrade, currentTerm);
  const planSemester = inferPlanSemester(currentTerm);

  return planJson.courses
    .map((course) => {
      const name = course.name.trim();
      const isCompleted = completedNames.has(name);
      const rawCourse = course as Record<string, unknown>;
      return {
        code: course.code,
        name,
        credits: course.credits,
        category: course.category ?? null,
        subcategory: course.subcategory ?? null,
        term: course.term ?? {},
        status: isCompleted ? ("completed" as const) : ("available" as const),
        isRequired: isRequiredCourse({
          category: course.category,
          subcategory: course.subcategory,
          required_type: rawCourse.required_type as string | undefined,
          name: course.name
        })
      };
    })
    .filter((course) => {
      if (!currentTerm) return true;
      if (!planYear || !planSemester) return false;
      const term = course.term;
      return term.year === planYear && term.semester === planSemester;
    });
}

function summarizeCandidates(candidates: ReturnType<typeof deriveCandidates>) {
  const sumCredits = (courses: typeof candidates) => courses.reduce((sum, course) => sum + course.credits, 0);
  const completed = candidates.filter((course) => course.status === "completed");
  const remaining = candidates.filter((course) => course.status === "available");
  const requiredRemaining = remaining.filter((course) => course.isRequired);
  const electiveRemaining = remaining.filter((course) => !course.isRequired);

  return {
    totalCount: candidates.length,
    totalCredits: sumCredits(candidates),
    completedCount: completed.length,
    completedCredits: sumCredits(completed),
    remainingCount: remaining.length,
    remainingCredits: sumCredits(remaining),
    requiredRemainingCount: requiredRemaining.length,
    requiredRemainingCredits: sumCredits(requiredRemaining),
    electiveRemainingCount: electiveRemaining.length,
    electiveRemainingCredits: sumCredits(electiveRemaining)
  };
}

export function createCourseRecommendationsRouter(dependencies: Dependencies): Router {
  const router = Router();
  const requireAuth = authenticate(dependencies.authRepository);

  // GET /api/course-recommendations/candidates?term=...
  router.get("/candidates", requireAuth, async (req, res, next) => {
    try {
      const userId = req.userId ?? "";
      const term = String(req.query.term ?? "");
      const plan = await dependencies.programPlanRepository.getBoundPlan(userId);
      const gpaCourses = await dependencies.gpaRepository.listCourses(userId);
      const profile = await dependencies.authRepository.getProfile(userId);
      const gradeContext = resolveGradeContext(profile?.grade, plan?.grade ?? plan?.planJson?.program?.grade);
      const candidates = deriveCandidates(plan?.planJson ?? null, gpaCourses, gradeContext.gradeYear, term || undefined);
      const planYear = inferPlanYear(gradeContext.gradeYear, term || undefined);
      const planSemester = inferPlanSemester(term || undefined);
      res.json({
        hasPlan: Boolean(plan),
        termContext: {
          requestedTerm: term || null,
          planYear,
          planSemester,
          label: formatPlanTermLabel(planYear, planSemester),
          canInfer: Boolean(planYear && planSemester),
          gradeYear: gradeContext.gradeYear ?? null,
          gradeSource: gradeContext.gradeSource,
          profileGradeYear: gradeContext.profileGradeYear,
          planGradeYear: gradeContext.planGradeYear
        },
        courses: candidates,
        candidates,
        stats: summarizeCandidates(candidates)
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/course-recommendations/parse-image
  router.post("/parse-image", requireAuth, async (req, res, next) => {
    try {
      const input = parseImageSchema.parse(req.body);

      if (!process.env.DEEPSEEK_API_KEY) {
        res.status(503).json({
          error: { message: "AI 解析服务未配置：缺少 DEEPSEEK_API_KEY 环境变量" }
        });
        return;
      }

      const result = await parseCourseImage(input.imageBase64);

      // Ensure response has expected shape
      if (result && typeof result === "object" && "courses" in result && Array.isArray((result as Record<string, unknown>).courses)) {
        res.json(result);
        return;
      }

      // Fallback: wrap raw result
      res.json({ courses: [], raw: result });
    } catch (error) {
      console.error("[parse-image] error:", error);
      if (error instanceof Error) {
        res.status(500).json({ error: { message: `AI 解析失败：${error.message}` } });
      } else {
        next(error);
      }
    }
  });

  // POST /api/course-recommendations/semester-courses/batch
  router.post("/semester-courses/batch", requireAuth, async (req, res, next) => {
    try {
      const { term, courses } = req.body as { term: string; courses: unknown[] };
      if (!term || !Array.isArray(courses)) {
        throw new HttpError(400, "term and courses array are required");
      }
      const parsed = courses
        .map((c) => {
          try {
            return semesterCourseInputSchema.parse(c);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<ReturnType<typeof semesterCourseInputSchema.parse>>;

      const created = await dependencies.courseRecommendationRepository.batchCreateSemesterCourses(
        req.userId ?? "",
        term,
        parsed.map((p) => ({
          term: p.term,
          courseCode: p.courseCode,
          courseName: p.courseName,
          credits: p.credits,
          teacher: p.teacher,
          classroom: p.classroom,
          schedule: p.schedule,
          category: p.category,
          source: p.source,
          selected: p.selected
        }))
      );
      res.status(201).json({ courses: created });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/course-recommendations/semester-courses?term=...
  router.get("/semester-courses", requireAuth, async (req, res, next) => {
    try {
      const term = String(req.query.term ?? "");
      if (!term) {
        throw new HttpError(400, "term query parameter is required");
      }
      const courses = await dependencies.courseRecommendationRepository.listSemesterCourses(
        req.userId ?? "",
        term
      );
      res.json({ courses });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/course-recommendations/semester-courses
  router.post("/semester-courses", requireAuth, async (req, res, next) => {
    try {
      const input = semesterCourseInputSchema.parse(req.body);
      const course = await dependencies.courseRecommendationRepository.createSemesterCourse(
        req.userId ?? "",
        {
          term: input.term,
          courseCode: input.courseCode,
          courseName: input.courseName,
          credits: input.credits,
          teacher: input.teacher,
          classroom: input.classroom,
          schedule: input.schedule,
          category: input.category,
          source: input.source,
          selected: input.selected
        }
      );
      res.status(201).json({ course });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/course-recommendations/semester-courses/:id
  router.put("/semester-courses/:id", requireAuth, async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const course = await dependencies.courseRecommendationRepository.updateSemesterCourse(
        req.userId ?? "",
        id,
        req.body as Record<string, unknown>
      );
      if (!course) {
        throw new HttpError(404, "Course not found");
      }
      res.json({ course });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/course-recommendations/semester-courses/:id
  router.delete("/semester-courses/:id", requireAuth, async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const deleted = await dependencies.courseRecommendationRepository.deleteSemesterCourse(req.userId ?? "", id);
      if (!deleted) {
        throw new HttpError(404, "Course not found");
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // POST /api/course-recommendations/generate
  router.post("/generate", requireAuth, async (req, res, next) => {
    try {
      const input = generateRecommendationSchema.parse(req.body);
      const userId = req.userId ?? "";

      // Get candidates from program plan
      const plan = await dependencies.programPlanRepository.getBoundPlan(userId);
      const gpaCoursesList = await dependencies.gpaRepository.listCourses(userId);
      const profile = await dependencies.authRepository.getProfile(userId);
      const gradeContext = resolveGradeContext(profile?.grade, plan?.grade ?? plan?.planJson?.program?.grade);
      const allCandidates = deriveCandidates(plan?.planJson ?? null, gpaCoursesList, gradeContext.gradeYear, input.term);
      const availableCandidates = allCandidates.filter((c) => c.status === "available");

      // Get semester courses with schedules
      const semesterCourses = await dependencies.courseRecommendationRepository.listSemesterCourses(userId, input.term);

      const recommendationResult = generateDeterministicRecommendation(
        availableCandidates,
        semesterCourses.map((sc) => ({
          courseName: sc.courseName,
          courseCode: sc.courseCode,
          credits: Number(sc.credits),
          teacher: sc.teacher,
          classroom: sc.classroom,
          schedule: sc.schedule
        })),
        input.preferences
      );

      // Save recommendation
      const saved = await dependencies.courseRecommendationRepository.saveRecommendation(
        userId,
        input.term,
        input.preferences as Record<string, unknown>,
        {
          recommendedCourses: recommendationResult.recommendedCourses as unknown[],
          totalCredits: recommendationResult.totalCredits,
          summary: recommendationResult.summary,
          warnings: recommendationResult.warnings,
          conflicts: recommendationResult.conflicts
        }
      );

      res.json({ recommendation: saved });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/course-recommendations/history?term=...
  router.get("/history", requireAuth, async (req, res, next) => {
    try {
      const term = String(req.query.term ?? "");
      if (!term) {
        throw new HttpError(400, "term query parameter is required");
      }
      const recommendations = await dependencies.courseRecommendationRepository.listRecommendations(
        req.userId ?? "",
        term
      );
      res.json({ recommendations });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
