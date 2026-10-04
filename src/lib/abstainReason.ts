export type AbstainReason = "SELF" | "CANNOT_SPEAK" | "OTHER";

export const ABSTAIN_REASON_ORDER: AbstainReason[] = [
  "SELF",
  "CANNOT_SPEAK",
  "OTHER",
];

export const ABSTAIN_REASON_LABELS: Record<AbstainReason, string> = {
  SELF: "თავი შეიკავა",
  CANNOT_SPEAK: "საუბარი არ შეუძლია",
  OTHER: "სხვა",
};

export function parseAbstainReason(raw: unknown): AbstainReason | null {
  if (raw === "SELF" || raw === "CANNOT_SPEAK" || raw === "OTHER") return raw;
  return null;
}

/** Legacy rows without abstainReason count as SELF. */
export function effectiveAbstainReason(
  reason: AbstainReason | null | undefined,
): AbstainReason {
  return reason ?? "SELF";
}

export function abstainReasonLabel(
  reason: AbstainReason | null | undefined,
): string {
  return ABSTAIN_REASON_LABELS[effectiveAbstainReason(reason)];
}
