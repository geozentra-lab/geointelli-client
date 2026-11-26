import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Page } from '../core/models/api';
import {
  LenderApplicationCreateRequest,
  LenderApplicationDTO,
  LenderApplicationStage,
  LenderApplicationUpdateRequest,
  LenderApprovedFundedCardDTO,
  LenderCollateralAnalysisDTO,
  LenderImportRequest,
  LenderImportResult,
  LenderMemberLookupDTO,
  LenderOrganizationDTO,
  LenderPipelineDTO,
} from '../core/models/lender';
import { queryParams } from './http-params';

/** Lender endpoints; every application call is scoped by the organizationId query parameter. */
@Injectable({ providedIn: 'root' })
export class LenderService {
  private http = inject(HttpClient);
  private api = environment.apiUrl + '/lender';

  organizations() {
    return this.http.get<LenderOrganizationDTO[]>(this.api + '/organizations');
  }
  createOrganization(name: string) {
    return this.http.post<LenderOrganizationDTO>(this.api + '/organizations', { name });
  }
  members(organizationId: number) {
    return this.http.get<number[]>(`${this.api}/organizations/${organizationId}/members`);
  }
  /**
   * Owner only: the account that signs in with this email (exact, case ignored). 404 when no
   * account uses it; an account exists once its owner has signed in to GeoZentra.
   */
  lookupMember(organizationId: number, email: string) {
    return this.http.get<LenderMemberLookupDTO>(
      `${this.api}/organizations/${organizationId}/members/lookup`,
      { params: { email } },
    );
  }
  addMember(organizationId: number, userId: number) {
    return this.http.post<void>(`${this.api}/organizations/${organizationId}/members`, { userId });
  }
  removeMember(organizationId: number, userId: number) {
    return this.http.delete<void>(`${this.api}/organizations/${organizationId}/members/${userId}`);
  }

  applications(
    organizationId: number,
    page = 0,
    stage: LenderApplicationStage | null = null,
    size = 20,
  ) {
    return this.http.get<Page<LenderApplicationDTO>>(this.api + '/applications', {
      params: queryParams({ organizationId, page, size, stage }),
    });
  }
  createApplication(organizationId: number, body: LenderApplicationCreateRequest) {
    return this.http.post<LenderApplicationDTO>(this.api + '/applications', body, {
      params: queryParams({ organizationId }),
    });
  }
  /** Send only the fields that changed: an omitted field stays as it is, null clears it. */
  updateApplication(organizationId: number, id: number, body: LenderApplicationUpdateRequest) {
    return this.http.patch<LenderApplicationDTO>(`${this.api}/applications/${id}`, body, {
      params: queryParams({ organizationId }),
    });
  }
  pipeline(organizationId: number) {
    return this.http.get<LenderPipelineDTO>(this.api + '/pipeline', {
      params: queryParams({ organizationId }),
    });
  }
  /** Loan-to-value from the linked property's stored valuation; informational only. */
  collateralAnalysis(organizationId: number, id: number) {
    return this.http.get<LenderCollateralAnalysisDTO>(
      `${this.api}/applications/${id}/collateral-analysis`,
      { params: queryParams({ organizationId }) },
    );
  }
  /** Approved, funded and loan mix over UTC days; both dates or none (the current month). */
  approvedFunded(organizationId: number, fromDate?: string | null, toDate?: string | null) {
    return this.http.get<LenderApprovedFundedCardDTO>(
      environment.apiUrl + '/dashboards/lender/approved-funded',
      { params: queryParams({ organizationId, fromDate, toDate }) },
    );
  }
  importApplications(organizationId: number, body: LenderImportRequest) {
    return this.http.post<LenderImportResult>(this.api + '/applications/import', body, {
      params: queryParams({ organizationId }),
    });
  }
}
