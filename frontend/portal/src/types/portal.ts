export type ScanFinding = {
  finding_type?: string;
  checkName?: string;
  title?: string;
  severity?: string;
  status?: string;
  passed?: boolean;
  description?: string;
  detail?: string;
  evidence?: string;
  remediation?: string;
  gdpr_article?: string;
};

export type ScanRecord = {
  id: string;
  scanType: string;
  targetIdentifier: string;
  status: string;
  score: number | null;
  riskLevel?: string | null;
  findingsJson?: ScanFinding[];
  createdAt: string;
  completedAt?: string | null;
};

export type DsrRecord = {
  id: string;
  subjectEmail: string;
  subjectName?: string | null;
  requestType: string;
  status: string;
  reasonText?: string | null;
  dueDate: string;
  createdAt: string;
  resolvedAt?: string | null;
};
