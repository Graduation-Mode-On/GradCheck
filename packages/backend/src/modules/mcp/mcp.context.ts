import type { AuthRepository } from "../auth/auth.repository.js";
import type { Database } from "../../db/client.js";
import type { CoursesProgressRepository } from "../courses-progress/courses-progress.repository.js";
import type { CustomRequirementRepository } from "../custom-requirements/custom-requirement.repository.js";
import type { GpaRepository } from "../gpa/gpa.repository.js";
import type { ProgramPlanRepository } from "../program-plans/program-plans.repository.js";
import type { LabExamEventsDatabase } from "../lab-exam-events/lab-exam-events.repository.js";
import type { LabExamEventRepository } from "../lab-exam-events/lab-exam-events.types.js";
import type { RemindersDatabase } from "../reminders/reminders.repository.js";
import type { ReminderRepository } from "../reminders/reminders.types.js";
import type { HomeSummaryDependencies } from "../home-summary/home-summary.service.js";

export interface McpContext {
  userId: string;
}

export interface McpDependencies {
  authRepository: AuthRepository;
  reminderRepository: ReminderRepository;
  coursesProgressRepository: CoursesProgressRepository;
  gpaRepository: GpaRepository;
  programPlanRepository: ProgramPlanRepository;
  customRequirementRepository: CustomRequirementRepository;
  homeSummaryDependencies: HomeSummaryDependencies;
  labExamEvents: {
    db: Database;
    createLabExamEventRepository: (database: LabExamEventsDatabase) => LabExamEventRepository;
    createReminderRepository: (database: RemindersDatabase) => ReminderRepository;
  };
  rateLimitPerMinute: number;
}
