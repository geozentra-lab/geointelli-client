import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page, RealtorLicenseStatus, UserDTO } from '../core/models/api';
import {
  ProfessionalRole,
  RealtorLicenseReviewDTO,
  RequestableRole,
  RoleGrantEventDTO,
  RoleRequestReviewDTO,
  RoleRequestStatus,
} from '../core/models/account';
import { queryParams } from './http-params';

/** One page of the role-request queue; null status or role means all of them. */
export interface RoleRequestQuery {
  status: RoleRequestStatus | null;
  role: RequestableRole | null;
  page: number;
}
/** One page of the realtor-license queue. */
export interface LicenseQuery {
  status: RealtorLicenseStatus;
  page: number;
}

/**
 * Account-type approval for administrators (backend SCRUM-204, realm role admin): the investor and
 * lender role requests, the realtor license reviews, and a user's role history with revoke. The
 * decisions change Keycloak realm roles, so they answer 503 when Keycloak role management is down.
 */
@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/admin';

  roleRequests(q: RoleRequestQuery, size = 20) {
    return this.http.get<Page<RoleRequestReviewDTO>>(this.base + '/role-requests', {
      params: queryParams({ status: q.status, role: q.role, page: q.page, size }),
    });
  }
  /** The reason is optional (up to 500 characters); without one the body is empty. */
  approveRoleRequest(id: number, reason: string | null) {
    return this.http.post<RoleRequestReviewDTO>(
      `${this.base}/role-requests/${id}/approve`,
      reason ? { reason } : {},
    );
  }
  /** The reason is required (up to 500 characters) and shown to the applicant. */
  rejectRoleRequest(id: number, reason: string) {
    return this.http.post<RoleRequestReviewDTO>(`${this.base}/role-requests/${id}/reject`, {
      reason,
    });
  }

  realtorLicenses(q: LicenseQuery, size = 20) {
    return this.http.get<Page<RealtorLicenseReviewDTO>>(
      this.base + '/realtor-license-verifications',
      { params: queryParams({ status: q.status, page: q.page, size }) },
    );
  }
  /** The registry the license was checked against is required (up to 200 characters). */
  approveLicense(id: number, registrySource: string) {
    return this.http.post<RealtorLicenseReviewDTO>(
      `${this.base}/realtor-license-verifications/${id}/approve`,
      { registrySource },
    );
  }
  rejectLicense(id: number, registrySource: string, rejectionReason: string) {
    return this.http.post<RealtorLicenseReviewDTO>(
      `${this.base}/realtor-license-verifications/${id}/reject`,
      { registrySource, rejectionReason },
    );
  }

  /**
   * The account that signs in with this email (exact, case ignored; the newest when old rows share
   * it). 404 when none: an account exists once its owner has signed in to GeoZentra.
   */
  findUser(email: string) {
    return this.http.get<UserDTO>(this.base + '/users', { params: { email } });
  }
  /** Every grant and revoke of a user's professional roles, newest first. */
  roleGrants(userId: number) {
    return this.http.get<RoleGrantEventDTO[]>(`${this.base}/users/${userId}/role-grants`);
  }
  /**
   * Takes a professional role away (reason required, up to 500 characters). A pending role request
   * of the user is not changed by it. The answer's body isn't used: the history is read again.
   */
  revokeRole(userId: number, role: ProfessionalRole, reason: string) {
    return this.http.post<unknown>(`${this.base}/users/${userId}/roles/${role}/revoke`, {
      reason,
    });
  }
}
