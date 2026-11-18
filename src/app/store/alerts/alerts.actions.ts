import { createActionGroup, props } from '@ngrx/store';
import {
  Page,
  AlertRuleDTO,
  AlertRuleRequest,
  AlertRuleUpdate,
  AlertMonitoringDTO,
} from '../../core/models/api';
export const alertsActions = createActionGroup({
  source: 'alerts API',
  events: {
    Load: props<{ page: number }>(),
    Loaded: props<{ page: Page<AlertRuleDTO> }>(),
    Create: props<{ request: AlertRuleRequest }>(),
    Update: props<{ id: number; request: AlertRuleUpdate }>(),
    Remove: props<{ id: number }>(),
    Saved: props<{ item: AlertRuleDTO }>(),
    Removed: props<{ id: number }>(),
    Failed: props<{ error: string; operation: 'load' | 'save' }>(),
    Monitoring: props<{ id: number }>(),
    'Monitoring loaded': props<{ id: number; status: AlertMonitoringDTO }>(),
    'Monitoring failed': props<{ id: number; error: string }>(),
    Evaluate: props<{ id: number }>(),
    'Evaluation scheduled': props<{ id: number }>(),
  },
});
