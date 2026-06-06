import express from "express";
import multer from "multer";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { ProgramPlanRepository } from "./program-plans.repository.js";
import { curriculumPlanSchema, importProgramPlanSchema } from "./program-plans.schemas.js";
import samplePlan from "./sample-plan.json" with { type: "json" };

export function createProgramPlansRouter(
  authRepository: AuthRepository,
  programPlanRepository: ProgramPlanRepository
): express.Router {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

  router.use(authenticate(authRepository));

  router.get("/me", async (req, res, next) => {
    try {
      res.json({ plan: await programPlanRepository.getBoundPlan(req.userId ?? "") });
    } catch (error) {
      next(error);
    }
  });

  router.get("/reusable", async (req, res, next) => {
    try {
      res.json({ plans: await programPlanRepository.listReusablePlans(req.userId ?? "") });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/bind", async (req, res, next) => {
    try {
      const result = await programPlanRepository.bindExistingPlan(req.userId ?? "", req.params.id);
      if (!result) {
        res.status(404).json({ error: { message: "Program plan was not found" } });
        return;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/mock-upload", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file?.originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ error: { message: "Only PDF files are supported" } });
        return;
      }
      const planJson = curriculumPlanSchema.parse({
        ...samplePlan,
        provenance: { ...samplePlan.provenance, source_pdf: req.file.originalname }
      });
      res.json({ preview: summarize(req.file.originalname, planJson) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/import", async (req, res, next) => {
    try {
      const input = importProgramPlanSchema.parse(req.body);
      const result = await programPlanRepository.createAndBind(req.userId ?? "", input.sourceFilename, input.planJson);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function summarize(sourceFilename: string, planJson: ReturnType<typeof curriculumPlanSchema.parse>) {
  return {
    sourceFilename,
    school: planJson.program.school,
    college: planJson.program.college ?? null,
    major: planJson.program.major,
    grade: planJson.program.grade ?? null,
    totalCredits: planJson.program.total_credits == null ? null : String(planJson.program.total_credits),
    courseCount: planJson.courses.length,
    requirementCount: planJson.requirements.length,
    warningCount: planJson.warnings.length,
    planJson
  };
}
