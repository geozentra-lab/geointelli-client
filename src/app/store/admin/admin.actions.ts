import { createActionGroup, props } from '@ngrx/store';
import { Page } from '../../core/models/api';
import {
  DataQualityReportDTO,
  DataQualityRule,
  ValuationRefreshRequestDTO,
  ValuationRefreshStatus,
} from '../../core/models/admin';
export const AdminActions = createActionGroup({
  source: 'Admin API',
  events: {
    /** Every rule's count, and one page of issues when a rule is chosen. */
    'Load data quality': props<{ rule: DataQualityRule | null; page: number }>(),
    'Data quality loaded': props<{ report: DataQualityReportDTO }>(),
    'Data quality failed': props<{ error: string }>(),
    'Load refresh requests': props<{ status: ValuationRefreshStatus | null; page: number }>(),
    'Refresh requests loaded': props<{ page: Page<ValuationRefreshRequestDTO> }>(),
    'Refresh requests failed': props<{ error: string }>(),
    'Cancel refresh': props<{ id: string }>(),
    /** The key is made once per click, so a repeated request creates one retry only. */
    'Retry refresh': props<{ id: string; idempotencyKey: string }>(),
    'Refresh request changed': props<{ id: string; request: ValuationRefreshRequestDTO }>(),
    'Refresh action failed': props<{ id: string; error: string }>(),
  },
});
