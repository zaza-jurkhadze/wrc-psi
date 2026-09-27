import * as XLSX from "xlsx";

export type ImportedPatientRow = {
  personalId: string | null;
  fullName: string;
  birthDate: Date | null;
  age: number | null;
  mobile: string | null;
  historyNumber: string | null;
  careType: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  dischargedAt: Date | null;
  doctorName: string | null;
  departmentName: string | null;
};

const COL = {
  personalId: "პაციენტის პ/ნ",
  fullName: "პაციენტი",
  birthDate: "დაბ.თარიღი",
  age: "ასაკი",
  mobile: "პაციენტის მობილური",
  historyNumber: "ისტორიის #",
  careType: "სტაც/ამბ",
  openedAt: "გახსნა",
  closedAt: "დახურვა",
  dischargedAt: "გაწერა",
  doctorName: "ექიმი",
  departmentName: "განყოფილება",
} as const;

function cell(row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key];
  const found = Object.keys(row).find((k) => k.trim() === key.trim());
  return found ? row[found] : undefined;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
  }
  const s = String(v).trim();
  // dd/MM/yyyy or dd/MM/yyyy HH:mm:ss
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, hh, mm, ss] = m;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh || 0),
      Number(mm || 0),
      Number(ss || 0),
    );
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePatientsExcel(buffer: ArrayBuffer): ImportedPatientRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const result: ImportedPatientRow[] = [];

  for (const row of rows) {
    const fullName = asString(cell(row, COL.fullName));
    if (!fullName) continue;

    result.push({
      personalId: asString(cell(row, COL.personalId)),
      fullName,
      birthDate: asDate(cell(row, COL.birthDate)),
      age: asInt(cell(row, COL.age)),
      mobile: asString(cell(row, COL.mobile)),
      historyNumber: asString(cell(row, COL.historyNumber)),
      careType: asString(cell(row, COL.careType)),
      openedAt: asDate(cell(row, COL.openedAt)),
      closedAt: asDate(cell(row, COL.closedAt)),
      dischargedAt: asDate(cell(row, COL.dischargedAt)),
      doctorName: asString(cell(row, COL.doctorName)),
      departmentName: asString(cell(row, COL.departmentName)),
    });
  }

  return result;
}
