export type TopProblem = {
  question: string;
  count: number;
};

type SurveyLike = {
  assessment: string;
  answers: {
    isNegative?: boolean;
    reason?: string | null;
    question: { text: string } | null;
  }[];
};

/**
 * ტოპ პრობლემები კითხვების მიხედვით — კლებადობით (ყველაზე ხშირი ზემოთ).
 * თუ გადაეცემა allQuestions (მაგ. 8 კითხვა), ყველა შედის სიაში, მათ შორის 0-ითაც.
 */
export function topProblemsByAssessment(
  surveys: SurveyLike[],
  level: string,
  limit = 8,
  allQuestions?: string[],
): TopProblem[] {
  const filtered = surveys.filter((s) => s.assessment === level);
  const counts = new Map<string, number>();

  if (allQuestions?.length) {
    for (const q of allQuestions) {
      const text = q.trim();
      if (text) counts.set(text, 0);
    }
  }

  for (const s of filtered) {
    for (const a of s.answers || []) {
      const text = a.question?.text?.trim() || "უცნობი კითხვა";
      if (!counts.has(text)) counts.set(text, 0);

      const isProblem = Boolean(a.isNegative) || Boolean(a.reason?.trim());
      if (isProblem) {
        counts.set(text, (counts.get(text) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count || a.question.localeCompare(b.question, "ka"))
    .slice(0, limit);
}

export function formatTopProblemsBlock(title: string, problems: TopProblem[]): string[] {
  if (problems.length === 0) {
    return [`${title} მონაცემი არ არის`];
  }
  return [
    title,
    ...problems.map((p, i) => `  ${i + 1}. ${p.question} — ${p.count}-ჯერ`),
  ];
}
