import type { ImportedPatientRow } from "./excel";

/** HIS API → იმპორტის იგივე ფორმატი. კონფიგი: HIS_API_URL, HIS_API_KEY */
export async function fetchPatientsFromHis(): Promise<ImportedPatientRow[]> {
  const url = process.env.HIS_API_URL;
  if (!url) {
    throw new Error("HIS API არ არის კონფიგურირებული (HIS_API_URL)");
  }

  const headers: HeadersInit = { Accept: "application/json" };
  if (process.env.HIS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.HIS_API_KEY}`;
  }

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HIS API შეცდომა: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : data.patients || data.data || [];

  return list.map((item: Record<string, unknown>): ImportedPatientRow => {
    const str = (k: string) => {
      const v = item[k];
      if (v === null || v === undefined || v === "") return null;
      return String(v);
    };
    const num = (k: string) => {
      const v = item[k];
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const date = (k: string) => {
      const v = item[k];
      if (!v) return null;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d;
    };

    return {
      personalId: str("personalId") || str("personal_id") || str("pin"),
      fullName: str("fullName") || str("full_name") || str("name") || "უცნობი",
      birthDate: date("birthDate") || date("birth_date"),
      age: num("age"),
      mobile: str("mobile") || str("phone"),
      historyNumber: str("historyNumber") || str("history_number") || str("historyId"),
      careType: str("careType") || str("care_type"),
      openedAt: date("openedAt") || date("opened_at"),
      closedAt: date("closedAt") || date("closed_at"),
      dischargedAt: date("dischargedAt") || date("discharged_at"),
      doctorName: str("doctorName") || str("doctor"),
      departmentName: str("departmentName") || str("department"),
    };
  });
}
