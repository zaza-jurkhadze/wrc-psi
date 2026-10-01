export type ParsedBraceletQr = {
  fullName: string;
  personalId: string;
  historyNumber: string;
  birthDate: string; // YYYY-MM-DD
};

const BIRTH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERSONAL_ID_LINE_RE = /(\d{11})/;
const HISTORY_IN_NAME_LINE_RE = /(\d+)\s*\//;

/**
 * Parses multiline text from patient bracelet QR codes, e.g.:
 * ლაბურიძე
 * იოსები 12087/26
 * პ/ნ 38001038169
 * 1959-04-01
 */
export function parsePatientBraceletQr(raw: string): ParsedBraceletQr | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 4) return null;

  const lastName = lines[0];
  const nameLine = lines[1];
  const idLine = lines[2];
  const birthLine = lines[3];

  const birthMatch = birthLine.match(BIRTH_DATE_RE);
  if (!birthMatch) return null;

  const personalMatch = idLine.match(PERSONAL_ID_LINE_RE);
  if (!personalMatch) return null;

  const historyMatch = nameLine.match(HISTORY_IN_NAME_LINE_RE);
  if (!historyMatch) return null;

  const historyNumber = historyMatch[1];
  const firstName = nameLine
    .replace(HISTORY_IN_NAME_LINE_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!firstName || !lastName) return null;

  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

  return {
    fullName,
    personalId: personalMatch[1],
    historyNumber,
    birthDate: birthLine,
  };
}
