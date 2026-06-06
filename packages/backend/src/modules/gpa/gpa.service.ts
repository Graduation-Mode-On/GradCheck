import { HttpError } from "../../lib/http-error.js";
import { calculateGpaResult } from "./gpa.calculator.js";
import type { GpaRepository } from "./gpa.repository.js";
import type { GpaCourseInput } from "./gpa.types.js";

const COURSE_NOT_FOUND_MESSAGE = "GPA course was not found";

function isInvalidCourseIdError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "22P02";
}

function throwCourseNotFound(): never {
  throw new HttpError(404, COURSE_NOT_FOUND_MESSAGE);
}

export async function getGpaDashboard(repository: GpaRepository, userId: string) {
  const courses = await repository.listCourses(userId);
  return { courses, result: calculateGpaResult(courses) };
}

export async function createGpaCourse(repository: GpaRepository, userId: string, input: GpaCourseInput) {
  return repository.createCourseAndRecalculate(userId, input);
}

export async function updateGpaCourse(repository: GpaRepository, userId: string, courseId: string, input: GpaCourseInput) {
  let dashboard;
  try {
    dashboard = await repository.updateCourseAndRecalculate(userId, courseId, input);
  } catch (error) {
    if (isInvalidCourseIdError(error)) {
      throwCourseNotFound();
    }
    throw error;
  }

  if (!dashboard) {
    throwCourseNotFound();
  }

  return dashboard;
}

export async function deleteGpaCourse(repository: GpaRepository, userId: string, courseId: string) {
  let dashboard;
  try {
    dashboard = await repository.deleteCourseAndRecalculate(userId, courseId);
  } catch (error) {
    if (isInvalidCourseIdError(error)) {
      throwCourseNotFound();
    }
    throw error;
  }

  if (!dashboard) {
    throwCourseNotFound();
  }

  return dashboard;
}
