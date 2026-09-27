import { hash } from "bcryptjs";
import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "z.jurkhadze@gmail.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const name = process.env.SEED_ADMIN_NAME || "ადმინისტრატორი";

  const passwordHash = await hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  const directorEmail = "director@wrc.ge".toLowerCase();
  const directorPassword = "Director123!";
  await prisma.user.upsert({
    where: { email: directorEmail },
    create: {
      email: directorEmail,
      name: "სამედიცინო დირექტორი",
      passwordHash: await hash(directorPassword, 10),
      role: "MEDICAL_DIRECTOR",
    },
    update: {
      name: "სამედიცინო დირექტორი",
      passwordHash: await hash(directorPassword, 10),
      role: "MEDICAL_DIRECTOR",
      active: true,
    },
  });

  const qualityEmail = "quality@wrc.ge".toLowerCase();
  const qualityPassword = "Quality123!";
  await prisma.user.upsert({
    where: { email: qualityEmail },
    create: {
      email: qualityEmail,
      name: "ხარისხის მართვის მენეჯერი",
      passwordHash: await hash(qualityPassword, 10),
      role: "QUALITY_MANAGER",
    },
    update: {
      name: "ხარისხის მართვის მენეჯერი",
      passwordHash: await hash(qualityPassword, 10),
      role: "QUALITY_MANAGER",
      active: true,
    },
  });

  const interviewerEmail = "interviewer@wrc.ge".toLowerCase();
  const interviewerPassword = "Interview123!";
  await prisma.user.upsert({
    where: { email: interviewerEmail },
    create: {
      email: interviewerEmail,
      name: "ინტერვიუერი",
      passwordHash: await hash(interviewerPassword, 10),
      role: "INTERVIEWER",
    },
    update: {
      name: "ინტერვიუერი",
      passwordHash: await hash(interviewerPassword, 10),
      role: "INTERVIEWER",
      active: true,
    },
  });

  const existing = await prisma.questionnaire.findFirst({ where: { active: true } });
  if (!existing) {
    const q = await prisma.questionnaire.create({
      data: {
        title: "პაციენტის მომსახურების ინდექსი",
        description: "საწყისი შაბლონი — შეცვალეთ კითხვარის რედაქტორში",
        active: true,
        questions: {
          create: [
            {
              text: "კმაყოფილი ხართ მოვლის ხარისხით?",
              type: QuestionType.SINGLE_CHOICE,
              order: 1,
              options: {
                create: [
                  { label: "დიახ", value: "yes", order: 1, isNegative: false },
                  { label: "არა", value: "no", order: 2, isNegative: true, requireReason: true },
                ],
              },
            },
            {
              text: "კმაყოფილი ხართ პერსონალის კომუნიკაციით?",
              type: QuestionType.SINGLE_CHOICE,
              order: 2,
              options: {
                create: [
                  { label: "დიახ", value: "yes", order: 1, isNegative: false },
                  { label: "არა", value: "no", order: 2, isNegative: true, requireReason: true },
                ],
              },
            },
            {
              text: "როგორ აფასებთ საერთო მომსახურებას? (1–5)",
              type: QuestionType.RATING,
              order: 3,
              ratingMin: 1,
              ratingMax: 5,
            },
          ],
        },
      },
    });
    console.log("Created sample questionnaire", q.id);
  }

  console.log("Seed OK:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
