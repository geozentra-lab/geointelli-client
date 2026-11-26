import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AdminAccessService } from './admin-access.service';

describe('AdminAccessService', () => {
  let http: HttpTestingController;
  let api: AdminAccessService;
  const base = environment.apiUrl + '/admin';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AdminAccessService);
  });
  afterEach(() => http.verify());

  it('calls the SCRUM-204 admin endpoints with their methods, parameters and bodies', () => {
    api.roleRequests({ status: 'REVOKED', role: 'investor', page: 1 }).subscribe();
    const list = http.expectOne((r) => r.url === base + '/role-requests');
    expect(list.request.params.toString()).toBe('status=REVOKED&role=investor&page=1&size=20');
    list.flush({ content: [] });

    api.approveRoleRequest(5, null).subscribe();
    expect(http.expectOne(base + '/role-requests/5/approve').request.body).toEqual({});
    api.rejectRoleRequest(5, 'No').subscribe();
    expect(http.expectOne(base + '/role-requests/5/reject').request.body).toEqual({ reason: 'No' });

    api.realtorLicenses({ status: 'VERIFIED', page: 0 }).subscribe();
    const licenses = http.expectOne((r) => r.url === base + '/realtor-license-verifications');
    expect(licenses.request.params.toString()).toBe('status=VERIFIED&page=0&size=20');
    licenses.flush({ content: [] });
    api.approveLicense(9, 'Florida DBPR licensee search').subscribe();
    expect(http.expectOne(base + '/realtor-license-verifications/9/approve').request.body).toEqual({
      registrySource: 'Florida DBPR licensee search',
    });
    api.rejectLicense(9, 'Florida DBPR licensee search', 'Expired').subscribe();
    expect(http.expectOne(base + '/realtor-license-verifications/9/reject').request.body).toEqual({
      registrySource: 'Florida DBPR licensee search',
      rejectionReason: 'Expired',
    });

    api.roleGrants(7).subscribe();
    expect(http.expectOne(base + '/users/7/role-grants').request.method).toBe('GET');
    api.revokeRole(7, 'realtor', 'Left the brokerage').subscribe();
    const revoke = http.expectOne(base + '/users/7/roles/realtor/revoke');
    expect(revoke.request.method).toBe('POST');
    expect(revoke.request.body).toEqual({ reason: 'Left the brokerage' });
    http.match(() => true).forEach((r) => r.flush(null));
  });
});
