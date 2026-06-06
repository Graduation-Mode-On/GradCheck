import { createDb } from "./db/client.js";
import { loadConfig } from "./lib/config.js";
import { createApp } from "./app.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createCustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = createApp({
  authRepository: createAuthRepository(db),
  customRequirementRepository: createCustomRequirementRepository(db),
  corsOrigin: config.CORS_ORIGIN
});

app.listen(config.PORT, () => {
  console.log(`GradCheck backend listening on port ${config.PORT}`);
});
