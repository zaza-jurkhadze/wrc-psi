-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INTERVIEWER', 'HEAD_NURSE', 'QUALITY_MANAGER', 'MEDICAL_DIRECTOR', 'GENERAL_DIRECTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'RATING', 'SHORT_TEXT', 'LONG_TEXT');

-- CreateEnum
CREATE TYPE "AssessmentLevel" AS ENUM ('GOOD', 'ATTENTION', 'FIX_NEEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INTERVIEWER',
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "personalId" TEXT,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "age" INTEGER,
    "mobile" TEXT,
    "historyNumber" TEXT,
    "careType" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "doctorName" TEXT,
    "departmentId" TEXT,
    "departmentName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRoster" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "ratingMin" INTEGER DEFAULT 1,
    "ratingMax" INTEGER DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "requireReason" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "surveyDate" DATE NOT NULL,
    "comment" TEXT,
    "assessment" "AssessmentLevel" NOT NULL,
    "authorId" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedValues" TEXT[],
    "textValue" TEXT,
    "ratingValue" INTEGER,
    "reason" TEXT,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "surveyDate" DATE NOT NULL,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Patient_personalId_idx" ON "Patient"("personalId");

-- CreateIndex
CREATE INDEX "Patient_historyNumber_idx" ON "Patient"("historyNumber");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "DailyRoster_date_idx" ON "DailyRoster"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRoster_patientId_date_key" ON "DailyRoster"("patientId", "date");

-- CreateIndex
CREATE INDEX "Survey_surveyDate_idx" ON "Survey"("surveyDate");

-- CreateIndex
CREATE INDEX "Survey_assessment_idx" ON "Survey"("assessment");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_patientId_surveyDate_questionnaireId_key" ON "Survey"("patientId", "surveyDate", "questionnaireId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRoster" ADD CONSTRAINT "DailyRoster_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
