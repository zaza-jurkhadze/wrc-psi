import { AssessmentLevel } from "@prisma/client";
import { answersForScoring } from "./notApplicable";

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
  const scorable = answersForScoring(answers);
  if (scorable.length === 0) return AssessmentLevel.GOOD;

  const negativeCount = scorable.filter((a) => a.isNegative).length;
  const ratio = negativeCount / scorable.length;

  if (negativeCount === 0) return AssessmentLevel.GOOD;
  if (ratio >= 0.5) return AssessmentLevel.FIX_NEEDED;
  return AssessmentLevel.ATTENTION;
}

export { assessmentLabel } from "./labels";
