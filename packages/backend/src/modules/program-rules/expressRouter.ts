import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import express from "express";
import multer from "multer";
import { DraftCorrectionService } from "./correction.js";
import { ProgramParsePipeline } from "./pipeline.js";
import { ProgramRuleRepository } from "./repository.js";

export interface ProgramRulesRouterOptions {
  storageDir?: string;
  uploadTmpDir?: string;
  pipeline?: ProgramParsePipeline;
}

export function createProgramRulesRouter(options: ProgramRulesRouterOptions = {}): express.Router {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
  const repository = new ProgramRuleRepository(options.storageDir);
  const pipeline = options.pipeline ?? new ProgramParsePipeline({ repository });
  const correctionService = new DraftCorrectionService();
  const tmpDir = options.uploadTmpDir ?? "data/uploads/tmp";

  router.post("/program-rules/uploads", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file?.originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ error: "Only PDF files are supported" });
        return;
      }

      await mkdir(tmpDir, { recursive: true });
      const tmpPath = join(tmpDir, `${randomUUID()}.pdf`);
      await writeFile(tmpPath, req.file.buffer);
      try {
        const draft = await pipeline.parse({
          pdfPath: tmpPath,
          metadata: {
            school: req.body.school,
            college: req.body.college,
            major: req.body.major,
            grade: req.body.grade,
            version: req.body.version,
            sourceFilename: req.file.originalname
          },
          save: true
        });
        res.json(draft);
      } finally {
        await unlink(tmpPath).catch(() => undefined);
      }
    } catch (error) {
      next(error);
    }
  });

  router.get("/program-rules/:draftId", async (req, res, next) => {
    try {
      res.json(await repository.get(req.params.draftId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/program-rules/:draftId/requirements", async (req, res, next) => {
    try {
      res.json(await repository.getRequirementSet(req.params.draftId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/program-rules/:draftId/course-catalog", async (req, res, next) => {
    try {
      res.json(await repository.getCourseCatalog(req.params.draftId));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/program-rules/:draftId", async (req, res, next) => {
    try {
      const draft = await repository.get(req.params.draftId);
      const corrected = correctionService.apply(draft, req.body);
      await repository.save(corrected);
      res.json(corrected);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
