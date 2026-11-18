import { NotificationDTO } from '../../core/models/notification';
export interface NotificationsState {
  items: NotificationDTO[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  pending: number[];
  readError: string | null;
}
