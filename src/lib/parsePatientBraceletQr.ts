export type ParsedBraceletQr = {
  fullName: string;
  personalId: string;
  historyNumber: string;
  birthDate: string; // YYYY-MM-DD
};

const PERSONAL_ID_LINE_RE = /(\d{11})/;
/** Full history number including suffix, e.g. 12087/26 */
const HISTORY_NUMBER_RE = /(\d+\/\d+)/;

function normalizeLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseBirthDate(line: string): string | null {
  const iso = line.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return line;

  const dmy = line.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  return null;
}

function buildResult(
  firstName: string,
  lastName: string,
  personalId: string,
  historyNumber: string,
  birthLine: string,
): ParsedBraceletQr | null {
  const birthDate = parseBirthDate(birthLine);
  if (!birthDate) return null;
  if (!firstName || !lastName) return null;
  if (!/^\d{11}$/.test(personalId)) return null;
  if (!HISTORY_NUMBER_RE.test(historyNumber)) return null;

  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

  return {
    fullName,
    personalId,
    historyNumber,
    birthDate,
  };
}

/**
 * Bracelet QR (5 lines), e.g.:
 * N: 12087/26
 * ლაბუჩიძე
 * იოსები
 * 38001038169
 * 01/04/1959
 */
function tryParseFiveLineFormat(lines: string[]): ParsedBraceletQr | null {
  if (lines.length < 5) return null;

  const historyMatch = lines[0].match(HISTORY_NUMBER_RE);
  const personalId = lines[3].match(/^\d{11}$/) ? lines[3] : null;
  const birthLine = lines[4];

  if (!historyMatch || !personalId) return null;
  if (!/^N:\s*/i.test(lines[0]) && !lines[0].includes("/")) return null;

  return buildResult(
    lines[2],
    lines[1],
    personalId,
    historyMatch[1],
    birthLine,
  );
}

/**
 * Legacy QR (4 lines), e.g.:
 * ლაბურიძე
 * იოსები 12087/26
 * პ/ნ 38001038169
 * 1959-04-01
 */
function tryParseLegacyFourLineFormat(lines: string[]): ParsedBraceletQr | null {
  if (lines.length < 4) return null;

  const lastName = lines[0];
  const nameLine = lines[1];
  const idLine = lines[2];
  const birthLine = lines[3];

  const historyMatch = nameLine.match(HISTORY_NUMBER_RE);
  const personalMatch = idLine.match(PERSONAL_ID_LINE_RE);
  if (!historyMatch || !personalMatch) return null;

  const historyNumber = historyMatch[1];
  const firstName = nameLine
    .replace(historyMatch[0], "")
    .replace(/\s+/g, " ")
    .trim();

  return buildResult(
    firstName,
    lastName,
    personalMatch[1],
    historyNumber,
    birthLine,
  );
}

export function parsePatientBraceletQr(raw: string): ParsedBraceletQr | null {
  const lines = normalizeLines(raw);
  if (lines.length < 4) return null;

  return tryParseFiveLineFormat(lines) ?? tryParseLegacyFourLineFormat(lines);
}
