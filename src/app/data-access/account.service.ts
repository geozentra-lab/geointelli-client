import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RoleRequestCreate, RoleRequestDTO, UserEntitlementsDTO } from '../core/models/account';

/** The signed-in user's account type, onboarding and role requests (backend SCRUM-204). */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/users/me';
  /** Roles and features come from the access token: read again after every login and token refresh. */
  entitlements() {
    return this.http.get<UserEntitlementsDTO>(this.base + '/entitlements');
  }
  /** "Home buyer" on the onboarding page: completes it without a role and returns the entitlements. */
  completeOnboarding() {
    return this.http.post<UserEntitlementsDTO>(this.base + '/onboarding/complete', null);
  }
  /** 201 PENDING (APPROVED when the backend grants that role at once); 409 if another role is held or pending. */
  requestRole(body: RoleRequestCreate) {
    return this.http.post<RoleRequestDTO>(this.base + '/role-requests', body);
  }
  /** The user's role requests, newest first. */
  roleRequests() {
    return this.http.get<RoleRequestDTO[]>(this.base + '/role-requests');
  }
  /** 409 when an admin has already decided it. */
  cancelRoleRequest(id: number) {
    return this.http.post<RoleRequestDTO>(`${this.base}/role-requests/${id}/cancel`, null);
  }
}
