import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UserDTO, UserProfileUpdate, UserPreferencesDTO } from '../core/models/api';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}
  me() {
    return this.http.get<UserDTO>(this.baseUrl + '/me');
  }
  updateProfile(body: UserProfileUpdate) {
    return this.http.patch<UserDTO>(this.baseUrl + '/me', body);
  }
  preferences() {
    return this.http.get<UserPreferencesDTO>(this.baseUrl + '/me/preferences');
  }
  updatePreferences(body: UserPreferencesDTO) {
    return this.http.put<UserPreferencesDTO>(this.baseUrl + '/me/preferences', body);
  }
}
