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

/**
 * კარგი პასუხების % (N/A — მიზეზი 0 — არ входят).
 * ≥70% კარგია · 50–69% საყურადღებოა · &lt;50% გამოსასწორებელია
 * (30–50% ზონა შედის „გამოსასწორებელში“).
 */
export function computeAssessment(answers: AnswerInput[]): AssessmentLevel {
  const scorable = answersForScoring(answers);
  if (scorable.length === 0) return AssessmentLevel.GOOD;

  const goodCount = scorable.filter((a) => !a.isNegative).length;
  const goodPercent = (goodCount / scorable.length) * 100;

  if (goodPercent >= 70) return AssessmentLevel.GOOD;
  if (goodPercent >= 50) return AssessmentLevel.ATTENTION;
  return AssessmentLevel.FIX_NEEDED;
}

export { assessmentLabel } from "./labels";
