import type { AxiosProgressEvent } from "axios";

export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
}

export interface SkippedRecord {
  raw: Record<string, string>;
  reason: string;
}

export interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
}

export interface JobStatusResponse {
  status: "processing" | "done" | "error";
  completedBatches: number;
  totalBatches: number;
  result: ImportResult | null;
  error: string | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

export async function startImport(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<{ jobId: string; totalBatches: number }> {
  const axios = (await import("axios")).default;
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await axios.post(`${API_BASE}/api/upload/start`, formData, {
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (e.total && onUploadProgress) {
          onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return res.data;
  } catch (err: any) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      "Failed to start import.";
    throw new Error(message);
  }
}


export async function pollJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE}/api/upload/status/${jobId}`);
  if (!res.ok) {
    let message = `Failed to fetch job status (status ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export const CRM_COLUMNS: { key: keyof CrmRecord; label: string }[] = [
  { key: "created_at", label: "Created At" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "country_code", label: "Country Code" },
  { key: "mobile_without_country_code", label: "Mobile" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "lead_owner", label: "Lead Owner" },
  { key: "crm_status", label: "Status" },
  { key: "crm_note", label: "Note" },
  { key: "data_source", label: "Source" },
  { key: "possession_time", label: "Possession Time" },
  { key: "description", label: "Description" },
];