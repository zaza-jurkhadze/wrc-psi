import { AssessmentLevel } from "@prisma/client";

export type AnswerInput = {
  questionId: string;
  selectedValues: string[];
  textValue?: string | null;
  ratingValue?: number | null;
  reason?: string | null;
  isNegative: boolean;
};

/** კარგია / საყურადღებოა / გამოსასწორებელია */
export function computeAssessment(answers: AnswerInput[]): AssessmentLevel {
  if (answers.length === 0) return AssessmentLevel.ATTENTION;

  const negativeCount = answers.filter((a) => a.isNegative).length;
  const ratio = negativeCount / answers.length;

  if (negativeCount === 0) return AssessmentLevel.GOOD;
  if (ratio >= 0.5) return AssessmentLevel.FIX_NEEDED;
  return AssessmentLevel.ATTENTION;
}

export { assessmentLabel } from "./labels";
