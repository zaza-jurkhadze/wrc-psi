export type AssessmentLevel =
  | "GOOD"
  | "ATTENTION"
  | "FIX_NEEDED"
  | "ABSTAINED";

export function assessmentLabel(level: AssessmentLevel | string): string {
  switch (level) {
    case "GOOD":
      return "კარგია";
    case "ATTENTION":
      return "საყურადღებოა";
    case "FIX_NEEDED":
      return "გამოსასწორებელია";
    case "ABSTAINED":
      return "თავი შეიკავა";
    default:
      return String(level);
  }
}
