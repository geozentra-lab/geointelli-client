import { RealtorLicenseStatus } from './api';

/**
 * Applicant side of realtor license verification (SCRUM-200). Only Florida licenses are accepted
 * today; decisions are taken by an administrator and are not made here.
 */
export interface RealtorLicenseVerificationDTO {
  id: number;
  licenseHolderName: string;
  licensingState: string;
  licenseNumber: string;
  licenseExpirationDate: string | null;
  brokerageName: string | null;
  workEmail: string | null;
  status: RealtorLicenseStatus;
  /** Set when an administrator rejected the submission. */
  rejectionReason: string | null;
  submittedAt: string;
  decidedAt: string | null;
}
export interface RealtorLicenseSubmission {
  /** 1 to 160 characters. */
  licenseHolderName: string;
  /** Two letters; only FL is accepted. */
  licensingState: string;
  /** 1 to 40 characters. */
  licenseNumber: string;
  /** yyyy-MM-dd, today or later. */
  licenseExpirationDate?: string;
  brokerageName?: string;
  workEmail?: string;
}
export const LICENSE_STATUS_LABELS: Record<RealtorLicenseStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};
