import { eq } from "drizzle-orm";

import { auditLogs, userProfiles, users } from "../../db/schema.js";
import type { Database } from "../../db/client.js";
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
      const [profile] = await db
        .insert(userProfiles)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: { ...input, updatedAt: new Date() }
        })
        .returning();

      return profile;
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
