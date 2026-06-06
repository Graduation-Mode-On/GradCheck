import { Router } from "express";
import multer from "multer";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { GpaRepository } from "./gpa.repository.js";
import { gpaCourseInputSchema, gpaTranscriptImportSchema } from "./gpa.schemas.js";
import { createGpaCourse, deleteGpaCourse, getGpaDashboard, importGpaTranscriptCourses, updateGpaCourse } from "./gpa.service.js";
import { parseTranscriptPdf } from "./transcript-parser.js";

export function createGpaRouter(authRepository: AuthRepository, gpaRepository: GpaRepository): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  router.get("/", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await getGpaDashboard(gpaRepository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/courses", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.status(201).json(await createGpaCourse(gpaRepository, req.userId ?? "", input));
    } catch (error) {
      next(error);
    }
  });

  router.post("/transcript/preview", authenticate(authRepository), upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file?.originalname.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ error: { message: "Only PDF files are supported" } });
        return;
      }

      const courses = await parseTranscriptPdf(req.file.buffer);
      res.json({
        preview: {
          sourceFilename: req.file.originalname,
          courseCount: courses.length,
          importableCourseCount: courses.filter((course) => course.isGpaEligible).length,
          courses,
          warnings: courses.flatMap((course) => course.warnings)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/transcript/import", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaTranscriptImportSchema.parse(req.body);
      const result = await importGpaTranscriptCourses(gpaRepository, req.userId ?? "", input.courses);
      res.status(result.importedCount > 0 ? 201 : 200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.put<{ id: string }>("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.json(await updateGpaCourse(gpaRepository, req.userId ?? "", req.params.id, input));
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await deleteGpaCourse(gpaRepository, req.userId ?? "", req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
