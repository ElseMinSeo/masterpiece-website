import type { SubmittedApplication } from "@/lib/apply/schema";
import type { ApplicationStatus } from "@/lib/types";
import type { Application } from "./types";

export interface ApplicationRow {
  id: string;
  number: string;
  status: ApplicationStatus;
  submitted_at: string;
  idempotency_key: string;
  answers: SubmittedApplication;
}

export function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    submittedAt: row.submitted_at,
    idempotencyKey: row.idempotency_key,
    data: row.answers,
  };
}
