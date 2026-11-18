import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  ContactProfessionalPage,
  ContactResponseDTO,
  PropertyContactRequest,
} from '../core/models/contact';
@Injectable({ providedIn: 'root' })
export class ContactRequestService {
  private http = inject(HttpClient);
  private base = environment.apiUrl + '/contact-requests';
  /** Registered REALTOR accounts (local ID and display name only); size is 1 to 100. */
  professionals(page = 0, size = 100) {
    return this.http.get<ContactProfessionalPage>(this.base + '/professionals', {
      params: { page, size },
    });
  }
  /** Same key + same body replays the original request (200); same key + new body is 409. */
  submit(body: PropertyContactRequest, idempotencyKey: string) {
    return this.http.post<ContactResponseDTO>(this.base, body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  get(id: number) {
    return this.http.get<ContactResponseDTO>(`${this.base}/${id}`);
  }
}
