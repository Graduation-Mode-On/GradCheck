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

export function deriveCustomRequirementStatus(input: StatusInput): CustomRequirementStatus {
  if (input.source === "pending_confirmation") {
    return "pending_confirmation";
  }

  if (input.currentValue >= input.targetValue) {
    return "completed";
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
