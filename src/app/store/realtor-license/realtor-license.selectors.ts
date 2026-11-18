import { createFeatureSelector } from '@ngrx/store';
import { RealtorLicenseState } from './realtor-license.reducer';
export const selectRealtorLicense = createFeatureSelector<RealtorLicenseState>('realtorLicense');
