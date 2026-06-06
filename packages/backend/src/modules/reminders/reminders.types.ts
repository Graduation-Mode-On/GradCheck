export type ReminderCategory = "lab" | "exam" | "custom" | "volunteer" | "labor" | "sports" | "other";
export type ReminderStatus = "pending" | "done" | "snoozed" | "cancelled";
export type ReminderPriority = "low" | "normal" | "high";
export type ReminderSourceType = "lab_exam_event" | "custom" | "system";
export type ReminderDeliveryChannel = "sms";
export type ReminderDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface ReminderDto {
  id: string;
  userId: string;
  title: string;
  category: ReminderCategory;
  status: ReminderStatus;
  priority: ReminderPriority;
  startAt: Date | null;
  dueAt: Date;
  location: string | null;
  notes: string | null;
  sourceType: ReminderSourceType;
  sourceId: string | null;
  reminderOffsets: number[];
  smsEnabled: boolean;
  showOnHome: boolean;
  completedAt: Date | null;
  snoozedUntil: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderInput {
  title: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  startAt: Date | null;
  dueAt: Date;
  location: string | null;
  notes: string | null;
  sourceType: ReminderSourceType;
  sourceId: string | null;
  reminderOffsets: number[];
  smsEnabled: boolean;
  showOnHome: boolean;
}

export type ReminderUpdateInput = Partial<
  ReminderInput & {
    status: ReminderStatus;
    completedAt: Date | null;
    snoozedUntil: Date | null;
    deletedAt: Date | null;
  }
>;

export interface ReminderFilters {
  status?: ReminderStatus;
  category?: ReminderCategory;
  showOnHome?: boolean;
  includeCompleted?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
}

export interface ReminderDeliveryLogDto {
  id: string;
  reminderId: string;
  channel: ReminderDeliveryChannel;
  status: ReminderDeliveryStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderDeliveryLogInput {
  reminderId: string;
  channel: ReminderDeliveryChannel;
  status: ReminderDeliveryStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
}

export interface ReminderRepository {
  listByUserId(userId: string, filters?: ReminderFilters): Promise<ReminderDto[]>;
  findById(userId: string, id: string): Promise<ReminderDto | null>;
  create(userId: string, input: ReminderInput): Promise<ReminderDto>;
  update(userId: string, id: string, input: ReminderUpdateInput): Promise<ReminderDto | null>;
  softDelete(userId: string, id: string): Promise<boolean>;
  listDueSmsCandidates(now: Date): Promise<ReminderDto[]>;
  findDeliveryLog(
    reminderId: string,
    channel: ReminderDeliveryChannel,
    scheduledAt: Date
  ): Promise<ReminderDeliveryLogDto | null>;
  createDeliveryLog(input: ReminderDeliveryLogInput): Promise<ReminderDeliveryLogDto>;
}
