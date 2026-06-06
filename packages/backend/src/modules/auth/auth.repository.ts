import { eq } from "drizzle-orm";

import { auditLogs, userProfiles, users } from "../../db/schema.js";
import type { Database } from "../../db/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { UserProfile, UserProfileInput } from "../users/user.repository.js";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface AuditLogInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(userId: string, input: UserProfileInput): Promise<UserProfile>;
  recordAuditLog(input: AuditLogInput): Promise<void>;
}

function isStudentIdConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const pgError = error as { code?: unknown; constraint?: unknown; detail?: unknown };
  if (pgError.code !== "23505") {
    return false;
  }
  const constraint = typeof pgError.constraint === "string" ? pgError.constraint : "";
  const detail = typeof pgError.detail === "string" ? pgError.detail : "";
  return constraint.includes("student_id") || detail.includes("student_id");
}

export function createAuthRepository(db: Database): AuthRepository {
  return {
    async findUserByEmail(email) {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user ?? null;
    },
    async findUserById(id) {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user ?? null;
    },
    async createUser(input) {
      const [user] = await db.insert(users).values(input).returning();
      return user;
    },
    async getProfile(userId) {
      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      return profile ?? null;
    },
    async upsertProfile(userId, input) {
      try {
        const [profile] = await db
          .insert(userProfiles)
          .values({ userId, ...input })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: { ...input, updatedAt: new Date() }
          })
          .returning();

        return profile;
      } catch (error) {
        if (isStudentIdConflict(error)) {
          throw new HttpError(409, "该学生一卡通已被其他账号使用");
        }
        throw error;
      }
    },
    async recordAuditLog(input) {
      await db.insert(auditLogs).values({
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {}
      });
    }
  };
}
