/** მიზეზი „0“ = კითხვა არ ეხება (მაგ. ახალი სემესტრი). მხოლოდ უარყოფით პასუხზე. */
export function isNotApplicableAnswer(answer: {
  isNegative?: boolean;
  reason?: string | null;
}): boolean {
  if (!answer.isNegative) return false;
  return (answer.reason ?? "").trim() === "0";
}

export function filterAnswersForScoring<T extends { isNegative?: boolean; reason?: string | null }>(
  answers: T[],
): T[] {
  return answers.filter((a) => !isNotApplicableAnswer(a));
}

/** @deprecated use filterAnswersForScoring */
export const answersForScoring = filterAnswersForScoring;
