import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { HttpError } from "../../lib/http-error.js";
import { getJwtSecret } from "../../lib/config.js";
import type { UserProfile } from "../users/user.repository.js";
import type { AuthRepository, UserRecord } from "./auth.repository.js";
import type { registerSchema, credentialsSchema } from "./auth.schemas.js";
import type { z } from "zod";

type RegisterInput = z.infer<typeof registerSchema>;
type CredentialsInput = z.infer<typeof credentialsSchema>;

export interface SafeUser {
  id: string;
  email: string;
  profile: UserProfile | null;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new HttpError(401, "Invalid authorization token");
  }

  return payload.sub;
}

async function toSafeUser(repository: AuthRepository, user: UserRecord): Promise<SafeUser> {
  const profile = await repository.getProfile(user.id);
  return {
    id: user.id,
    email: user.email,
    profile
  };
}

export async function registerUser(repository: AuthRepository, input: RegisterInput) {
  const existing = await repository.findUserByEmail(input.email);
  if (existing) {
    throw new HttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await repository.createUser({ email: input.email, passwordHash });

  if (input.profile) {
    await repository.upsertProfile(user.id, input.profile);
  }

  await repository.recordAuditLog({
    actorUserId: user.id,
    action: "auth.register",
    entityType: "user",
    entityId: user.id
  });

  return {
    token: signToken(user.id),
    user: await toSafeUser(repository, user)
  };
}

export async function loginUser(repository: AuthRepository, input: CredentialsInput) {
  const user = await repository.findUserByEmail(input.email);
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  await repository.recordAuditLog({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id
  });

  return {
    token: signToken(user.id),
    user: await toSafeUser(repository, user)
  };
}

export async function getCurrentUser(repository: AuthRepository, userId: string): Promise<SafeUser> {
  const user = await repository.findUserById(userId);
  if (!user) {
    throw new HttpError(401, "Invalid authorization token");
  }

  return toSafeUser(repository, user);
}
