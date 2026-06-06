import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { customRequirements } from "../../db/schema.js";
import { calculateCustomRequirementProgress, deriveCustomRequirementStatus } from "./custom-requirement.status.js";
import type { CustomRequirementDto } from "./custom-requirement.types.js";

export type CustomRequirementInput = Omit<
  CustomRequirementDto,
  "id" | "userId" | "status" | "progressPercent" | "createdAt" | "updatedAt"
>;
export type CustomRequirementUpdateInput = Partial<CustomRequirementInput>;

export interface CustomRequirementRepository {
  listByUserId(userId: string): Promise<CustomRequirementDto[]>;
  create(userId: string, input: CustomRequirementInput): Promise<CustomRequirementDto>;
  update(userId: string, id: string, input: CustomRequirementUpdateInput): Promise<CustomRequirementDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

function toNumber(value: string): number {
  return Number(value);
}

function toDto(row: typeof customRequirements.$inferSelect): CustomRequirementDto {
  const currentValue = toNumber(row.currentValue);
  const targetValue = toNumber(row.targetValue);
  const source = row.source as CustomRequirementDto["source"];
  const status = deriveCustomRequirementStatus({
    source,
    currentValue,
    targetValue,
    deadline: row.deadline
  });
  const progress = calculateCustomRequirementProgress({ currentValue, targetValue });

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    kind: row.kind as CustomRequirementDto["kind"],
    category: row.category as CustomRequirementDto["category"],
    targetValue: row.targetValue,
    currentValue: row.currentValue,
    unit: row.unit,
    importance: row.importance as CustomRequirementDto["importance"],
    source,
    includeInProgress: row.includeInProgress,
    showOnHome: row.showOnHome,
    deadline: row.deadline,
    notes: row.notes,
    status,
    progressPercent: progress.percent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function createCustomRequirementRepository(db: Database): CustomRequirementRepository {
  return {
    async listByUserId(userId) {
      const rows = await db.select().from(customRequirements).where(eq(customRequirements.userId, userId));
      return rows.map(toDto);
    },
    async create(userId, input) {
      const [row] = await db.insert(customRequirements).values({ userId, ...input }).returning();
      return toDto(row);
    },
    async update(userId, id, input) {
      const [row] = await db
        .update(customRequirements)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(customRequirements.userId, userId), eq(customRequirements.id, id)))
        .returning();
      return row ? toDto(row) : null;
    },
    async delete(userId, id) {
      const rows = await db
        .delete(customRequirements)
        .where(and(eq(customRequirements.userId, userId), eq(customRequirements.id, id)))
        .returning({ id: customRequirements.id });
      return rows.length > 0;
    }
  };
}
