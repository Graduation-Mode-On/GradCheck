import { createDb } from "../db/client.js";
import { createProgramPlanRepository } from "../modules/program-plans/program-plans.repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/gradcheck";
const db = createDb(databaseUrl);
const repository = createProgramPlanRepository(db);

const result = await repository.backfillNormalizedCourses();

console.log(`Backfilled normalized courses for ${result.planCount} program plan(s).`);
