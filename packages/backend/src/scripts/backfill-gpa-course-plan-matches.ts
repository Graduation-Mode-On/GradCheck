import { createDb } from "../db/client.js";
import { createGpaRepository } from "../modules/gpa/gpa.repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/gradcheck";
const db = createDb(databaseUrl);
const repository = createGpaRepository(db);
const userIds = await repository.listUserIdsWithGpaCourses();

let totalDeleted = 0;
let totalMatched = 0;

for (const userId of userIds) {
  const cleanup = await repository.cleanupTranscriptArtifactsAndRecalculate(userId);
  const matched = await repository.matchCoursesToProgramPlan(userId);
  totalDeleted += cleanup.deletedCount;
  totalMatched += matched.matchedCount;
}

console.log(`Cleaned ${totalDeleted} artifact course(s), matched ${totalMatched} GPA course(s) for ${userIds.length} user(s).`);
