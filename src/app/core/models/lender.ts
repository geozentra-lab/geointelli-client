/**
 * Lender contracts of property-service master (organizations, applications, pipeline, imports).
 * Tracking only: recording a stage does not approve credit or move funds. USD only.
 */
export type LenderApplicationStage =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'FUNDED'
  | 'REJECTED'
  | 'WITHDRAWN';
export const LENDER_STAGES: LenderApplicationStage[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'FUNDED',
  'REJECTED',
  'WITHDRAWN',
];
export const lenderStageLabels: Record<LenderApplicationStage, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  FUNDED: 'Funded',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};
export const TERMINAL_LENDER_STAGES: LenderApplicationStage[] = ['FUNDED', 'REJECTED', 'WITHDRAWN'];
/** Mirrors LenderApplicationStage.canChangeTo, excluding the always-allowed same-stage correction. */
export function nextLenderStages(stage: LenderApplicationStage): LenderApplicationStage[] {
  if (TERMINAL_LENDER_STAGES.includes(stage)) return [];
  const forward: Partial<Record<LenderApplicationStage, LenderApplicationStage[]>> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['FUNDED'],
  };
  return [...(forward[stage] ?? []), 'WITHDRAWN'];
}

/** Loan program; a missing or null loan type is stored as UNKNOWN. */
export type LenderLoanType = 'CONVENTIONAL' | 'FHA' | 'VA' | 'USDA' | 'UNKNOWN';
export const LOAN_TYPES: LenderLoanType[] = ['CONVENTIONAL', 'FHA', 'VA', 'USDA', 'UNKNOWN'];
export const loanTypeLabels: Record<LenderLoanType, string> = {
  CONVENTIONAL: 'Conventional',
  FHA: 'FHA',
  VA: 'VA',
  USDA: 'USDA',
  UNKNOWN: 'Not recorded',
};
export interface LenderOrganizationDTO {
  id: number;
  name: string;
  ownerUserId: number;
}
/**
 * The account an owner found by email to add to the team (GET .../members/lookup): `userId` goes
 * into the add-member call; `member` is true when it is already the owner or a member.
 */
export interface LenderMemberLookupDTO {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  member: boolean;
}
export interface LenderApplicationDTO {
  id: number;
  organizationId: number;
  createdByUserId: number;
  applicantName: string;
  applicantEmail: string | null;
  propertyId: number | null;
  requestedAmount: number;
  currency: string;
  stage: LenderApplicationStage;
  loanType: LenderLoanType;
  approvedAmount: number | null;
  fundedAmount: number | null;
  approvedAt: string | null;
  fundedAt: string | null;
  notes: string | null;
  source: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface LenderApplicationCreateRequest {
  applicantName: string;
  requestedAmount: number;
  applicantEmail?: string;
  propertyId?: number;
  currency?: 'USD';
  notes?: string;
  loanType?: LenderLoanType;
}
/** PATCH: omitted fields stay unchanged; null clears applicantEmail, propertyId or notes. */
export interface LenderApplicationUpdateRequest {
  applicantName?: string;
  applicantEmail?: string | null;
  propertyId?: number | null;
  requestedAmount?: number;
  stage?: LenderApplicationStage;
  approvedAmount?: number;
  fundedAmount?: number;
  notes?: string | null;
  /** null is stored as UNKNOWN. */
  loanType?: LenderLoanType | null;
}
export interface LenderStageTotals {
  count: number;
  requestedAmount: number;
}
export interface LenderPipelineDTO {
  organizationId: number;
  currency: string;
  total: number;
  stages: Partial<Record<LenderApplicationStage, LenderStageTotals>>;
  approvedCount: number;
  approvedAmount: number;
  fundedCount: number;
  fundedAmount: number;
  asOf: string;
  scope: string;
}
export interface LenderImportRow {
  externalId: string;
  applicantName: string;
  applicantEmail?: string | null;
  propertyId?: number | null;
  requestedAmount: number;
  currency: 'USD';
  stage: LenderApplicationStage;
  approvedAmount?: number | null;
  fundedAmount?: number | null;
  approvedAt?: string | null;
  fundedAt?: string | null;
  notes?: string | null;
  loanType?: LenderLoanType | null;
}
export interface LenderImportRequest {
  source: string;
  rows: LenderImportRow[];
}
export type LenderImportRowStatus = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'REJECTED';
export interface LenderImportRowResult {
  row: number;
  status: LenderImportRowStatus;
  applicationId: number | null;
  errorCode: 'INVALID_ROW' | 'INVALID_TRANSITION' | 'CONFLICT_RETRY_ROW' | string | null;
}
export interface LenderImportResult {
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  rows: LenderImportRowResult[];
}
export const LENDER_IMPORT_MAX_ROWS = 100;
/** Client-side shape check before sending; the backend still validates every row. */
export function parseLenderImport(
  text: string,
): { request: LenderImportRequest } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: 'This is not valid JSON. Check for missing commas or quotes.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { error: 'Expected an object with "source" and "rows".' };
  const { source, rows } = value as { source?: unknown; rows?: unknown };
  if (typeof source !== 'string' || !source.trim() || source.trim().length > 80)
    return { error: '"source" must be a name of 1 to 80 characters, for example "PARTNER_A".' };
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > LENDER_IMPORT_MAX_ROWS)
    return { error: `"rows" must be a list of 1 to ${LENDER_IMPORT_MAX_ROWS} applications.` };
  const bad = rows.findIndex((r) => !r || typeof r !== 'object' || Array.isArray(r));
  if (bad >= 0) return { error: `Row ${bad + 1} is not an object.` };
  return { request: { source: source.trim(), rows: rows as LenderImportRow[] } };
}
export const LENDER_IMPORT_EXAMPLE = `{
  "source": "PARTNER_A",
  "rows": [
    {
      "externalId": "APP-1001",
      "applicantName": "Jordan Rivera",
      "requestedAmount": 350000,
      "currency": "USD",
      "stage": "SUBMITTED",
      "loanType": "CONVENTIONAL"
    }
  ]
}`;

/**
 * GET /dashboards/lender/approved-funded: recorded amounts of one organization over a period of UTC
 * days (the current month without dates). EMPTY without approved or funded applications.
 */
export interface LenderApprovedFundedCardDTO {
  organizationId: number;
  currency: string;
  status: 'OK' | 'EMPTY' | 'ERROR' | string;
  error: string | null;
  generatedAt: string;
  period: { fromDate: string; toDate: string; timeZone: string };
  approved: { count: number; totalAmount: number };
  funded: { count: number; totalAmount: number };
  /** Every loan type, UNKNOWN included; the entries add up to funded. */
  fundedLoanMix: { loanType: LenderLoanType; count: number; totalAmount: number }[];
  note: string | null;
}
export type LtvStatus = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
/**
 * GET /lender/applications/{id}/collateral-analysis: the stored valuation of the linked property and
 * the loan-to-value it gives. Informational only; not a credit decision.
 */
export interface LenderCollateralAnalysisDTO {
  applicationId: number;
  organizationId: number;
  propertyId: number | null;
  currency: string;
  loanAmount: number | null;
  /** FUNDED if recorded, else APPROVED, else REQUESTED. */
  loanAmountBasis: 'FUNDED' | 'APPROVED' | 'REQUESTED' | string;
  collateral: {
    valuationStatus: 'supported' | 'limited' | 'unsupported' | string;
    value: number | null;
    range80: { low?: number | null; high?: number | null } | null;
    range90: { low?: number | null; high?: number | null } | null;
    confidence: string | null;
    valuationDate: string | null;
    modelVersion: string | null;
    reasons: { code: string; message: string }[] | null;
  } | null;
  ltv: { status: LtvStatus | string; percent: number | null; reasons: string[] };
  disclaimer: string;
}
/** Why an LTV could not be worked out, in words. */
export const LTV_REASONS: Record<string, string> = {
  NO_COLLATERAL_PROPERTY: 'No property is linked to this application.',
  COLLATERAL_PROPERTY_NOT_FOUND: 'The linked property no longer exists.',
  VALUATION_UNAVAILABLE: 'The property has no supported valuation.',
  INVALID_VALUATION: 'The stored valuation cannot be used.',
};
