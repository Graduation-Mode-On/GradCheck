import { HttpError } from "../../lib/http-error.js";
import type { ReminderDto, ReminderRepository, ReminderUpdateInput } from "../reminders/reminders.types.js";
import type {
  LabExamEventDto,
  LabExamEventFilters,
  LabExamEventInput,
  LabExamEventRepository,
  LabExamEventStatus,
  LabExamEventType,
  LabExamEventUpdateInput
} from "./lab-exam-events.types.js";

interface Dependencies {
  labExamEventRepository: LabExamEventRepository;
  reminderRepository: ReminderRepository;
}

type ReminderOptions = {
  smsEnabled: boolean;
  showOnHome: boolean;
  reminderOffsets: number[];
};

type CreateLabExamEventInput = Omit<LabExamEventInput, "reminderId"> & ReminderOptions;
type UpdateLabExamEventInput = LabExamEventUpdateInput & Partial<ReminderOptions>;

function categoryForEventType(eventType: LabExamEventType) {
  return eventType === "lab" ? "lab" : "exam";
}

function priorityForEventType(eventType: LabExamEventType) {
  return eventType === "final" ? "high" : "normal";
}

function notFound(): never {
  throw new HttpError(404, "Lab exam event not found");
}

function reminderSyncInput(event: LabExamEventDto, input: UpdateLabExamEventInput): ReminderUpdateInput {
  const eventType = input.eventType ?? event.eventType;
  const startAt = input.startAt ?? event.startAt;
  return {
    title: input.title ?? event.title,
    category: categoryForEventType(eventType),
    priority: priorityForEventType(eventType),
    startAt,
    dueAt: startAt,
    location: input.location !== undefined ? input.location : event.location,
    notes: input.notes !== undefined ? input.notes : event.notes,
    ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
    ...(input.showOnHome !== undefined ? { showOnHome: input.showOnHome } : {}),
    ...(input.reminderOffsets !== undefined ? { reminderOffsets: input.reminderOffsets } : {})
  };
}

function eventUpdateInput(input: UpdateLabExamEventInput): LabExamEventUpdateInput {
  const eventInput: UpdateLabExamEventInput = { ...input };
  delete eventInput.reminderOffsets;
  delete eventInput.showOnHome;
  delete eventInput.smsEnabled;
  return eventInput;
}

function assertValidTimeRange(startAt: Date, endAt: Date | null) {
  if (endAt && endAt <= startAt) {
    throw new HttpError(400, "endAt must be after startAt");
  }
}

export function createLabExamEventService({ labExamEventRepository, reminderRepository }: Dependencies) {
  return {
    async list(userId: string, filters: LabExamEventFilters = {}) {
      return labExamEventRepository.listByUserId(userId, filters);
    },

    async create(userId: string, input: CreateLabExamEventInput): Promise<{ event: LabExamEventDto; reminder: ReminderDto }> {
      const reminder = await reminderRepository.create(userId, {
        title: input.title,
        category: categoryForEventType(input.eventType),
        priority: priorityForEventType(input.eventType),
        sourceType: "lab_exam_event",
        sourceId: null,
        dueAt: input.startAt,
        startAt: input.startAt,
        location: input.location,
        notes: input.notes,
        reminderOffsets: input.reminderOffsets,
        smsEnabled: input.smsEnabled,
        showOnHome: input.showOnHome
      });

      const event = await labExamEventRepository.create(userId, {
        reminderId: reminder.id,
        title: input.title,
        courseName: input.courseName,
        eventType: input.eventType,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        teacher: input.teacher,
        seatOrGroup: input.seatOrGroup,
        notes: input.notes
      });

      const linkedReminder = await reminderRepository.update(userId, reminder.id, { sourceId: event.id });
      if (!linkedReminder) {
        throw new HttpError(500, "Failed to link reminder");
      }

      return { event, reminder: linkedReminder };
    },

    async update(
      userId: string,
      id: string,
      input: UpdateLabExamEventInput
    ): Promise<{ event: LabExamEventDto; reminder: ReminderDto }> {
      const existing = await labExamEventRepository.findById(userId, id);
      if (!existing) notFound();

      const eventInput = eventUpdateInput(input);
      assertValidTimeRange(eventInput.startAt ?? existing.startAt, eventInput.endAt !== undefined ? eventInput.endAt : existing.endAt);
      const event = await labExamEventRepository.update(userId, id, eventInput);
      if (!event) notFound();

      const reminder = await reminderRepository.update(userId, existing.reminderId, reminderSyncInput(event, input));
      if (!reminder) {
        throw new HttpError(500, "Linked reminder not found");
      }

      return { event, reminder };
    },

    async updateStatus(
      userId: string,
      id: string,
      status: LabExamEventStatus
    ): Promise<{ event: LabExamEventDto; reminder: ReminderDto }> {
      const existing = await labExamEventRepository.findById(userId, id);
      if (!existing) notFound();

      const event = await labExamEventRepository.update(userId, id, { status });
      if (!event) notFound();

      const reminder = await reminderRepository.update(userId, existing.reminderId, {
        status: status === "scheduled" ? "pending" : status,
        completedAt: status === "done" ? new Date() : null
      });
      if (!reminder) {
        throw new HttpError(500, "Linked reminder not found");
      }

      return { event, reminder };
    },

    async delete(userId: string, id: string) {
      const existing = await labExamEventRepository.findById(userId, id);
      if (!existing) notFound();

      const deleted = await labExamEventRepository.softDelete(userId, id);
      if (!deleted) notFound();
      await reminderRepository.softDelete(userId, existing.reminderId);
    }
  };
}
