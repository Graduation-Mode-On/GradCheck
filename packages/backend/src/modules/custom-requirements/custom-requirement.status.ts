import type { CustomRequirementSource, CustomRequirementStatus } from "./custom-requirement.types.js";

interface StatusInput {
  source: CustomRequirementSource;
  currentValue: number;
  targetValue: number;
  deadline: string | null;
  now?: Date;
}

interface ProgressInput {
  currentValue: number;
  targetValue: number;
}

function isWithinRiskWindow(deadline: string | null, now: Date): boolean {
  if (!deadline) {
    return false;
  }

  const [year, month, day] = deadline.split("-").map(Number);
  const deadlineDate = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilDeadline = (deadlineDate - today) / (1000 * 60 * 60 * 24);
  return daysUntilDeadline <= 14;
}

export function deriveCustomRequirementStatus(input: StatusInput): CustomRequirementStatus {
  if (input.source === "pending_confirmation") {
    return "pending_confirmation";
  }

  if (input.currentValue >= input.targetValue) {
    return "completed";
  }

  if (isWithinRiskWindow(input.deadline, input.now ?? new Date())) {
    return "at_risk";
  }

  if (input.currentValue > 0) {
    return "in_progress";
  }

  return "not_started";
}

export function calculateCustomRequirementProgress(input: ProgressInput): { ratio: number; percent: number } {
  if (input.targetValue <= 0) {
    return { ratio: 0, percent: 0 };
  }

  const ratio = Math.min(input.currentValue / input.targetValue, 1);
  return {
    ratio,
    percent: Math.round(ratio * 100)
  };
}
