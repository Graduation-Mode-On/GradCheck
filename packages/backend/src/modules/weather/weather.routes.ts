import express from "express";
import { z } from "zod";

import { HttpError } from "../../lib/http-error.js";

const weatherQuerySchema = z.object({
  city: z.string().min(1).default("320100"),
  extensions: z.enum(["base", "all"]).default("base")
});

interface AmapWeatherResponse {
  status: string;
  count: string;
  info: string;
  infocode: string;
  lives?: unknown[];
  forecasts?: unknown[];
}

export function createWeatherRouter(amapKey: string) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const query = weatherQuerySchema.parse(req.query);
      const url = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
      url.searchParams.set("key", amapKey);
      url.searchParams.set("city", query.city);
      url.searchParams.set("extensions", query.extensions);
      url.searchParams.set("output", "JSON");

      const response = await fetch(url);
      const body = (await response.json()) as AmapWeatherResponse;

      if (!response.ok || body.status !== "1") {
        throw new HttpError(502, body.info || "Amap weather service failed");
      }

      res.json({
        city: query.city,
        extensions: query.extensions,
        lives: body.lives ?? [],
        forecasts: body.forecasts ?? []
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
