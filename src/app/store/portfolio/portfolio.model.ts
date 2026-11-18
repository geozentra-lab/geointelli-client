import { EntityState } from '@ngrx/entity';
import {
  Page,
  PortfolioDTO,
  PortfolioRequest,
  HoldingDTO,
  HoldingRequest,
  PortfolioSummaryDTO,
  FinancialRecordDTO,
  FinancialRecordRequest,
} from '../../core/models/api';
export type PortfolioMutation =
  | { kind: 'create-portfolio'; body: PortfolioRequest }
  | { kind: 'update-portfolio'; id: number; body: PortfolioRequest }
  | { kind: 'remove-portfolio'; id: number }
  | { kind: 'add-holding'; id: number; body: HoldingRequest }
  | { kind: 'update-holding'; id: number; holdingId: number; body: HoldingRequest }
  | { kind: 'remove-holding'; id: number; holdingId: number }
  | { kind: 'add-record'; id: number; holdingId: number; body: FinancialRecordRequest }
  | {
      kind: 'update-record';
      id: number;
      holdingId: number;
      recordId: number;
      body: FinancialRecordRequest;
    }
  | { kind: 'remove-record'; id: number; holdingId: number; recordId: number };
export interface PortfolioState extends EntityState<PortfolioDTO> {
  summaryQuery: { fromDate?: string; toDate?: string };
  recordsQuery: { fromDate?: string; toDate?: string };
  page: Page<PortfolioDTO> | null;
  selectedId: number | null;
  holdings: EntityState<HoldingDTO>;
  holdingsPage: Page<HoldingDTO> | null;
  selectedHoldingId: number | null;
  summary: PortfolioSummaryDTO | null;
  records: Page<FinancialRecordDTO> | null;
  loading: boolean;
  holdingsLoading: boolean;
  summaryLoading: boolean;
  recordsLoading: boolean;
  saving: number;
  errors: Partial<Record<'list' | 'holdings' | 'summary' | 'records' | 'save', string>>;
}
