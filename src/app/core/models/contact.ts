/** Property contact requests (property-service master, /api/contact-requests). */
import { Page } from './api';

/** The consent wording shown to the user is versioned; the backend only accepts this version. */
export const CONTACT_CONSENT_VERSION = 'property-contact-v1';

export interface ContactProfessionalDTO {
  id: number;
  name: string;
}
export type ContactProfessionalPage = Page<ContactProfessionalDTO>;
export interface PropertyContactRequest {
  propertyId: number;
  professionalUserId: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  consent: true;
  consentVersion: typeof CONTACT_CONSENT_VERSION;
}
export interface ContactResponseDTO {
  id: number;
  propertyId: number;
  professionalUserId: number;
  leadId: number;
  /** SUBMITTED means saved. */
  status: string;
  /** PENDING / SENT / FAILED describes broker publication, not email delivery. */
  deliveryStatus: string;
  submittedAt: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  consentVersion: string;
}
/** Mirrors the backend @Pattern so invalid phones are caught before submitting. */
export const CONTACT_PHONE_PATTERN = '\\+?[0-9][0-9 ().-]{5,38}';
