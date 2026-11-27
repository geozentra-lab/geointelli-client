import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  Page,
  PortfolioDTO,
  HoldingDTO,
  FinancialRecordDTO,
  PortfolioSummaryDTO,
} from '../../core/models/api';
import { PortfolioMutation } from './portfolio.model';
export const portfolioActions = createActionGroup({
  source: 'Portfolio API',
  events: {
    Load: props<{ page: number }>(),
    Loaded: props<{ page: Page<PortfolioDTO> }>(),
    Select: props<{ id: number | null }>(),
    Refresh: emptyProps(),
    'Load holdings': props<{ id: number; page: number }>(),
    'Holdings loaded': props<{ id: number; page: Page<HoldingDTO> }>(),
    'Load summary': props<{ id: number; fromDate?: string; toDate?: string }>(),
    'Summary loaded': props<{ id: number; summary: PortfolioSummaryDTO }>(),
    'Select holding': props<{ holdingId: number | null }>(),
    'Load records': props<{
      id: number;
      holdingId: number;
      page: number;
      fromDate?: string;
      toDate?: string;
    }>(),
    'Records loaded': props<{ id: number; holdingId: number; page: Page<FinancialRecordDTO> }>(),
    Mutate: props<{ mutation: PortfolioMutation }>(),
    'Mutation succeeded': props<{ mutation?: PortfolioMutation }>(),
    Failed: props<{
      section: 'list' | 'holdings' | 'summary' | 'records' | 'save';
      error: string;
    }>(),
  },
});
