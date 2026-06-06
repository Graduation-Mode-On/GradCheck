import { createDb } from "./db/client.js";
import { loadConfig } from "./lib/config.js";
import { createApp } from "./app.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createLecturePracticeRepository } from "./modules/lecture-practice/lecture-practice.repository.js";
import { createNewsRepository } from "./modules/news/news.repository.js";
import { createPlazaRepository } from "./modules/plaza/plaza.repository.js";
import { createProgramPlanRepository } from "./modules/program-plans/program-plans.repository.js";
import { createSrtpRepository } from "./modules/srtp/srtp.repository.js";
import { createVolunteerLaborRepository } from "./modules/volunteer-labor/volunteer-labor.repository.js";
import { createCustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = createApp({
  authRepository: createAuthRepository(db),
  plazaRepository: createPlazaRepository(db),
  newsRepository: createNewsRepository(db),
  srtpRepository: createSrtpRepository(db),
  programPlanRepository: createProgramPlanRepository(db),
  lecturePracticeRepository: createLecturePracticeRepository(db),
  volunteerLaborRepository: createVolunteerLaborRepository(db),
  customRequirementRepository: createCustomRequirementRepository(db),
  corsOrigin: config.CORS_ORIGIN,
  amapWeatherKey: config.AMAP_WEATHER_KEY
});

app.listen(config.PORT, () => {
  console.log(`GradCheck backend listening on port ${config.PORT}`);
});
