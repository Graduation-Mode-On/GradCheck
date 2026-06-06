import { HttpError } from "../../lib/http-error.js";
import { calculateGpaResult } from "./gpa.calculator.js";
import type { GpaRepository } from "./gpa.repository.js";
import type { GpaCourseInput } from "./gpa.types.js";

const COURSE_NOT_FOUND_MESSAGE = "GPA course was not found";
const userOperationQueues = new Map<string, Promise<unknown>>();

function isInvalidCourseIdError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "22P02";
}

function throwCourseNotFound(): never {
  throw new HttpError(404, COURSE_NOT_FOUND_MESSAGE);
}

function runGpaOperation<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previousOperation = userOperationQueues.get(userId) ?? Promise.resolve();
  const currentOperation = previousOperation.catch(() => undefined).then(operation);
  userOperationQueues.set(userId, currentOperation);

  return currentOperation.finally(() => {
    if (userOperationQueues.get(userId) === currentOperation) {
      userOperationQueues.delete(userId);
    }
  });
}

async function recalculate(repository: GpaRepository, userId: string) {
  const courses = await repository.listCourses(userId);
  const result = calculateGpaResult(courses);
  await repository.upsertLatestResult(userId, result);

  return { courses, result };
}

export async function getGpaDashboard(repository: GpaRepository, userId: string) {
  return runGpaOperation(userId, () => recalculate(repository, userId));
}

export async function createGpaCourse(repository: GpaRepository, userId: string, input: GpaCourseInput) {
  return runGpaOperation(userId, async () => {
    await repository.createCourse(userId, input);
    return recalculate(repository, userId);
  });
}

export async function updateGpaCourse(repository: GpaRepository, userId: string, courseId: string, input: GpaCourseInput) {
  return runGpaOperation(userId, async () => {
    let course;
    try {
      course = await repository.updateCourse(userId, courseId, input);
    } catch (error) {
      if (isInvalidCourseIdError(error)) {
        throwCourseNotFound();
      }
      throw error;
    }

    if (!course) {
      throwCourseNotFound();
    }

    return recalculate(repository, userId);
  });
}

export async function deleteGpaCourse(repository: GpaRepository, userId: string, courseId: string) {
  return runGpaOperation(userId, async () => {
    let deleted;
    try {
      deleted = await repository.deleteCourse(userId, courseId);
    } catch (error) {
      if (isInvalidCourseIdError(error)) {
        throwCourseNotFound();
      }
      throw error;
    }

    if (!deleted) {
      throwCourseNotFound();
    }

    return recalculate(repository, userId);
  });
}
