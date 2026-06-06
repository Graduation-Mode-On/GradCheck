import { createDb } from "./db/client.js";
import { loadConfig } from "./lib/config.js";
import { createApp } from "./app.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createPlazaRepository } from "./modules/plaza/plaza.repository.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = createApp({
  authRepository: createAuthRepository(db),
  plazaRepository: createPlazaRepository(db),
  corsOrigin: config.CORS_ORIGIN,
  amapWeatherKey: config.AMAP_WEATHER_KEY
});

app.listen(config.PORT, () => {
  console.log(`GradCheck backend listening on port ${config.PORT}`);
});
