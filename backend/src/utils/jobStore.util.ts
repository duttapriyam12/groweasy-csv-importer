import { randomUUID } from "crypto";
import { ImportResult } from "../types/crm.types";

export interface JobState {
  status: "processing" | "done" | "error";
  completedBatches: number;
  totalBatches: number;
  result: ImportResult | null;
  error: string | null;
  createdAt: number;
}

const jobs = new Map<string, JobState>();

setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

export function createJob(totalBatches: number): string {
  const id = randomUUID();          
  jobs.set(id, {
    status: "processing",
    completedBatches: 0,
    totalBatches,
    result: null,
    error: null,
    createdAt: Date.now(),
  });
  return id;
}

export function incrementJobProgress(id: string): void {
  const job = jobs.get(id);
  if (job) job.completedBatches += 1;
}

export function completeJob(id: string, result: ImportResult): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "done";
    job.result = result;
  }
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "error";
    job.error = error;
  }
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}