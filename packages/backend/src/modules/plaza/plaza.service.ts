import { HttpError } from "../../lib/http-error.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type {
  CreatePlazaPostInput,
  PlazaListQuery,
  UpdatePlazaPostInput,
  UpdatePlazaPostStatusInput
} from "./plaza.schemas.js";
import type { PlazaRepository } from "./plaza.repository.js";
import type { PlazaPostRecord, PlazaPostResponse } from "./plaza.types.js";

async function toResponse(
  authRepository: AuthRepository,
  currentUserId: string,
  post: PlazaPostRecord
): Promise<PlazaPostResponse> {
  const profile = await authRepository.getProfile(post.authorUserId);
  return {
    ...post,
    authorDisplayName: profile?.displayName ?? "GradCheck 用户",
    isOwner: post.authorUserId === currentUserId
  };
}

async function requireOwnedPost(repository: PlazaRepository, userId: string, postId: string) {
  const post = await repository.findPostById(postId);
  if (!post) {
    throw new HttpError(404, "Plaza post not found");
  }
  if (post.authorUserId !== userId) {
    throw new HttpError(403, "You can only manage your own plaza posts");
  }
  return post;
}

export async function listPlazaPosts(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  query: PlazaListQuery
) {
  const result = await plazaRepository.listPosts(query);
  return {
    posts: await Promise.all(result.posts.map((post) => toResponse(authRepository, userId, post))),
    nextCursor: result.nextCursor
  };
}

export async function createPlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  input: CreatePlazaPostInput
) {
  const post = await plazaRepository.createPost({ ...input, authorUserId: userId, status: "open" });
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.create",
    entityType: "plaza_post",
    entityId: post.id
  });
  return toResponse(authRepository, userId, post);
}

export async function updatePlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string,
  input: UpdatePlazaPostInput
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  const post = await plazaRepository.updatePost(postId, input);
  if (!post) throw new HttpError(404, "Plaza post not found");
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.update",
    entityType: "plaza_post",
    entityId: post.id
  });
  return toResponse(authRepository, userId, post);
}

export async function updatePlazaPostStatus(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string,
  input: UpdatePlazaPostStatusInput
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  const post = await plazaRepository.updatePostStatus(postId, input.status);
  if (!post) throw new HttpError(404, "Plaza post not found");
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.status.update",
    entityType: "plaza_post",
    entityId: post.id,
    metadata: { status: input.status }
  });
  return toResponse(authRepository, userId, post);
}

export async function deletePlazaPost(
  authRepository: AuthRepository,
  plazaRepository: PlazaRepository,
  userId: string,
  postId: string
) {
  await requireOwnedPost(plazaRepository, userId, postId);
  await plazaRepository.softDeletePost(postId);
  await authRepository.recordAuditLog({
    actorUserId: userId,
    action: "plaza.post.delete",
    entityType: "plaza_post",
    entityId: postId
  });
}
