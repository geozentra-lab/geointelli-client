import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { NotificationDTO, NotificationPage } from '../core/models/notification';
import { NotificationPreferencesDTO, NotificationPreferencesRequest } from '../core/models/api';
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private url = environment.notificationApiUrl + '/notifications';
  list() {
    return this.http.get<NotificationPage>(this.url, { params: { page: 0, size: 5 } });
  }
  markRead(id: number) {
    return this.http.patch<NotificationDTO>(this.url + '/' + id, { read: true });
  }
  preferences() {
    return this.http.get<NotificationPreferencesDTO>(this.url + '/preferences');
  }
  /** Full replacement; the recipient address always comes from the verified token. */
  updatePreferences(body: NotificationPreferencesRequest) {
    return this.http.put<NotificationPreferencesDTO>(this.url + '/preferences', body);
  }
}
