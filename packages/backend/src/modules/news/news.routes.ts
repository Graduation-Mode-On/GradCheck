import { Router } from "express";

import { newsListQuerySchema } from "./news.schemas.js";
import type { NewsRepository } from "./news.repository.js";
import { listNewsItems } from "./news.service.js";

export function createNewsRouter(newsRepository: NewsRepository): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const result = await listNewsItems(newsRepository, newsListQuerySchema.parse(req.query));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
