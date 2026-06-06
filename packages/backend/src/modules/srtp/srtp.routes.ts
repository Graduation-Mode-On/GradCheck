import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { SrtpRepository } from "./srtp.repository.js";
import { srtpRecordInputSchema } from "./srtp.schemas.js";
import { createSrtpRecord, deleteSrtpRecord, getSrtpOverview, updateSrtpRecord } from "./srtp.service.js";

export function createSrtpRouter(authRepository: AuthRepository, srtpRepository: SrtpRepository): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/me", async (req, res, next) => {
    try {
      res.json(await getSrtpOverview(srtpRepository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/me/records", async (req, res, next) => {
    try {
      const record = await createSrtpRecord(srtpRepository, req.userId ?? "", srtpRecordInputSchema.parse(req.body));
      res.status(201).json({ record });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me/records/:id", async (req, res, next) => {
    try {
      const record = await updateSrtpRecord(
        srtpRepository,
        req.userId ?? "",
        req.params.id,
        srtpRecordInputSchema.parse(req.body)
      );
      res.json({ record });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/me/records/:id", async (req, res, next) => {
    try {
      await deleteSrtpRecord(srtpRepository, req.userId ?? "", req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

