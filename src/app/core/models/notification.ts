import { Page } from './api';
export interface NotificationDTO {
  id: number;
  eventType: string;
  title: string;
  message: string;
  alertRuleId: number | null;
  savedSearchId: number | null;
  propertyId: number | null;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
  readAt: string | null;
  read: boolean;
}
export type NotificationPage = Page<NotificationDTO>;
export function notificationUrl(item: NotificationDTO): string {
  // A contact request becomes a lead owned by the professional who received it.
  if (item.eventType === 'CONTACT_REQUEST') return '/crm/leads';
  if (item.propertyId != null && Number.isSafeInteger(item.propertyId) && item.propertyId > 0)
    return '/property/' + item.propertyId;
  if (item.alertRuleId != null) return '/alerts';
  if (item.savedSearchId != null) return '/saved';
  return '/alerts';
}
