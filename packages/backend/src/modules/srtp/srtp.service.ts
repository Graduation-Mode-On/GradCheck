import { HttpError } from "../../lib/http-error.js";
import type { SrtpRepository } from "./srtp.repository.js";
import type { SrtpOverview, SrtpRecord, SrtpRecordInput, SrtpSummary } from "./srtp.schemas.js";

function creditsToTenths(credits: string): number {
  return Math.round(Number(credits) * 10);
}

function tenthsToCredits(tenths: number): string {
  return (tenths / 10).toFixed(2);
}

export function summarizeSrtp(records: SrtpRecord[]): SrtpSummary {
  const totalTenths = records.reduce((sum, record) => sum + creditsToTenths(record.credits), 0);
  const passingTenths = 20;
  const excellentTenths = 60;
  return {
    totalCredits: tenthsToCredits(totalTenths),
    passingRequiredCredits: "2.00",
    excellentRequiredCredits: "6.00",
    status: totalTenths >= excellentTenths ? "excellent" : totalTenths >= passingTenths ? "passing" : "not_passing",
    missingForPassing: tenthsToCredits(Math.max(0, passingTenths - totalTenths)),
    missingForExcellent: tenthsToCredits(Math.max(0, excellentTenths - totalTenths))
  };
}

export async function getSrtpOverview(repository: SrtpRepository, userId: string): Promise<SrtpOverview> {
  const records = await repository.listRecords(userId);
  return { records, summary: summarizeSrtp(records) };
}

export async function createSrtpRecord(repository: SrtpRepository, userId: string, input: SrtpRecordInput) {
  return repository.createRecord(userId, input);
}

export async function updateSrtpRecord(repository: SrtpRepository, userId: string, id: string, input: SrtpRecordInput) {
  const record = await repository.updateRecord(userId, id, input);
  if (!record) throw new HttpError(404, "SRTP record not found");
  return record;
}

export async function deleteSrtpRecord(repository: SrtpRepository, userId: string, id: string) {
  const deleted = await repository.deleteRecord(userId, id);
  if (!deleted) throw new HttpError(404, "SRTP record not found");
}

