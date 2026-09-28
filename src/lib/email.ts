import nodemailer from "nodemailer";
import { Resend } from "resend";
import { AssessmentLevel } from "@prisma/client";
import { assessmentLabel } from "./assessment";
import { toClinicDayString } from "./dates";
import {
  formatTopProblemsBlock,
  type TopProblem,
} from "./problems";

export type DaySummary = {
  date: Date;
  rosterTotal: number;
  total: number;
  good: number;
  attention: number;
  fixNeeded: number;
  abstained?: number;
  attentionProblems?: TopProblem[];
  fixProblems?: TopProblem[];
};

function recipients(): string[] {
  const list = [
    process.env.EMAIL_TO_MEDICAL_DIRECTOR,
    process.env.EMAIL_TO_GENERAL_DIRECTOR,
    process.env.EMAIL_TO_QUALITY_MANAGER,
  ].filter((e): e is string => Boolean(e && e.trim()));
  return [...new Set(list)];
}

export function buildAggregateEmail(summary: DaySummary, appUrl: string) {
  const clinicDay = toClinicDayString(summary.date);
  const [y, m, d] = clinicDay.split("-");
  const dateStr = `${d}/${m}/${y}`;
  const subject = `PSI ანგარიში — ${dateStr}`;
  const body = [
    `პაციენტის მომსახურების ინდექსი — ყოველდღიური რეზიუმე`,
    ``,
    `თარიღი: ${dateStr}`,
    `გამოსაკითხი (დღის სია): ${summary.rosterTotal}`,
    `გამოკითხული: ${summary.total}`,
    ``,
    `ზოგადი შეფასება:`,
    `• კარგია — ${summary.good}`,
    `• საყურადღებოა — ${summary.attention}`,
    `• გამოსასწორებელია — ${summary.fixNeeded}`,
    `• თავი შეიკავა — ${summary.abstained ?? 0}`,
    ``,
    ...formatTopProblemsBlock(
      `ტოპ პრობლემები (საყურადღებოა):`,
      summary.attentionProblems || [],
    ),
    ``,
    ...formatTopProblemsBlock(
      `ტოპ პრობლემები (გამოსასწორებელია):`,
      summary.fixProblems || [],
    ),
    ``,
    `პაციენტების სახელები და პირადი მონაცემები ამ წერილში არ შედის.`,
    `დეტალების სანახავად შედით აპლიკაციაში: ${appUrl}/results`,
  ].join("\n");

  return { subject, body, to: recipients() };
}

async function sendMailViaResend(
  to: string[],
  subject: string,
  text: string,
): Promise<{ skipped: false }> {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  if (!apiKey) throw new Error("RESEND_API_KEY / SMTP_PASS არ არის მითითებული");
  const resend = new Resend(apiKey);
  const from = process.env.SMTP_FROM || "WRC PSI <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
  });
  if (error) {
    const msg =
      (error as { message?: string })?.message ||
      "Resend email გაგზავნა ვერ მოხერხდა";
    throw new Error(msg);
  }
  return { skipped: false };
}

async function sendMailViaSmtp(
  to: string[],
  subject: string,
  text: string,
): Promise<{ skipped: false }> {
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || undefined,
    },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: to.join(", "),
    subject,
    text,
  });
  return { skipped: false };
}

export async function sendMail(to: string[], subject: string, text: string) {
  const resendKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  if (resendKey) {
    try {
      return await sendMailViaResend(to, subject, text);
    } catch (e) {
      const msg = (e as Error).message || "";
      const smtpOk =
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS;
      const fatalResendError =
        msg.includes("validation_error") ||
        msg.includes("You can only send") ||
        msg.includes("To send emails to other recipients");
      if (!smtpOk || fatalResendError) {
        console.error("Resend failed (no fallback):", msg);
        throw e;
      }
      console.warn("Resend failed, fallback to SMTP:", msg);
      return sendMailViaSmtp(to, subject, text);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return sendMailViaSmtp(to, subject, text);
  }

  console.warn("Email service not configured — email skipped:", subject);
  return { skipped: true as const };
}

export function countByAssessment(rows: { assessment: AssessmentLevel }[]): {
  total: number;
  good: number;
  attention: number;
  fixNeeded: number;
  abstained: number;
} {
  return {
    total: rows.length,
    good: rows.filter((r) => r.assessment === AssessmentLevel.GOOD).length,
    attention: rows.filter((r) => r.assessment === AssessmentLevel.ATTENTION).length,
    fixNeeded: rows.filter((r) => r.assessment === AssessmentLevel.FIX_NEEDED).length,
    abstained: rows.filter((r) => String(r.assessment) === "ABSTAINED").length,
  };
}

export { assessmentLabel };
