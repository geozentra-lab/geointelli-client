import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  RealtorLicenseSubmission,
  RealtorLicenseVerificationDTO,
} from '../core/models/realtor-license';

@Injectable({ providedIn: 'root' })
export class RealtorLicenseService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/users/me/realtor-license';
  /** 409 while a submission is pending or verified; allowed again after a rejection. */
  submit(body: RealtorLicenseSubmission) {
    return this.http.post<RealtorLicenseVerificationDTO>(this.base, body);
  }
  /** Every submission, newest first; empty when the user never submitted one. */
  history() {
    return this.http.get<RealtorLicenseVerificationDTO[]>(this.base + '/history');
  }
}
