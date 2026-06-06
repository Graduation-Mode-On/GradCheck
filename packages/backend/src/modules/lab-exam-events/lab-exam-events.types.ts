export type LabExamEventType = "lab" | "midterm" | "final" | "quiz" | "other_exam";
export type LabExamEventStatus = "scheduled" | "done" | "cancelled";

export interface LabExamEventDto {
  id: string;
  userId: string;
  reminderId: string;
  title: string;
  courseName: string | null;
  eventType: LabExamEventType;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  teacher: string | null;
  seatOrGroup: string | null;
  notes: string | null;
  status: LabExamEventStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabExamEventInput {
  reminderId: string;
  title: string;
  courseName: string | null;
  eventType: LabExamEventType;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  teacher: string | null;
  seatOrGroup: string | null;
  notes: string | null;
}

export type LabExamEventUpdateInput = Partial<Omit<LabExamEventInput, "reminderId">> & {
  status?: LabExamEventStatus;
  deletedAt?: Date | null;
};

export interface LabExamEventFilters {
  status?: LabExamEventStatus;
  eventType?: LabExamEventType;
}

export interface LabExamEventRepository {
  listByUserId(userId: string, filters?: LabExamEventFilters): Promise<LabExamEventDto[]>;
  findById(userId: string, id: string): Promise<LabExamEventDto | null>;
  create(userId: string, input: LabExamEventInput): Promise<LabExamEventDto>;
  update(userId: string, id: string, input: LabExamEventUpdateInput): Promise<LabExamEventDto | null>;
  softDelete(userId: string, id: string): Promise<boolean>;
}
