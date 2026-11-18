import { HoldingOccupancy, PortfolioGeography, PortfolioMetric } from './api';
import { CrmTaskStatus, CrmTransactionStage, LeadStage } from './crm';

/**
 * Persona dashboard cards of property-service master. Each card is read as the bearer-token user
 * and names its scope and freshness; status ERROR is reserved for a card the server could not
 * build, EMPTY (where it exists) for a user without the underlying records.
 */
interface CardBase {
  scope: string;
  generatedAt: string;
  status: 'OK' | 'EMPTY' | 'ERROR' | string;
  error: string | null;
}

export type ActivityType =
  | 'FAVORITE_ADDED'
  | 'SAVED_SEARCH_CREATED'
  | 'SAVED_SEARCH_UPDATED'
  | 'ALERT_RULE_CREATED'
  | 'ALERT_RULE_UPDATED'
  | 'PORTFOLIO_CREATED'
  | 'PORTFOLIO_UPDATED'
  | 'HOLDING_ADDED'
  | 'HOLDING_UPDATED';
/**
 * GET /dashboards/user/activity: the newest things the user did, each a stored record with its
 * stored time. Deletions, sign-ins and views are not recorded, so they never appear.
 */
export interface ActivityCardDTO extends CardBase {
  limit: number;
  recent: {
    type: ActivityType;
    occurredAt: string;
    entityId: number;
    /** The search, rule or portfolio name; the property ID for favorites and holdings. */
    label: string | null;
    propertyId: number | null;
    portfolioId: number | null;
  }[];
}

/** GET /dashboards/realtor/clients-leads: CRM contacts and leads of the current user. */
export interface RealtorClientsLeadsCardDTO extends CardBase {
  limit: number;
  clients: {
    total: number;
    recent: {
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      createdAt: string;
    }[];
  };
  leads: {
    total: number;
    /** NEW + CONTACTED + QUALIFIED. */
    open: number;
    /** Every stage is present, 0 when empty. */
    byStage: Record<LeadStage, number>;
    recent: {
      id: number;
      clientId: number;
      clientName: string;
      propertyId: number | null;
      title: string;
      source: string;
      stage: LeadStage;
      createdAt: string;
    }[];
  };
}

export interface RealtorTaskItem {
  id: number;
  title: string;
  status: CrmTaskStatus;
  dueAt: string;
  clientId: number | null;
  leadId: number | null;
  propertyId: number | null;
  transactionId: number | null;
}
/** GET /dashboards/realtor/tasks-pipeline: follow-up tasks and deals of the current user. */
export interface RealtorTasksPipelineCardDTO extends CardBase {
  limit: number;
  tasks: {
    summary: {
      total: number;
      open: number;
      inProgress: number;
      completed: number;
      cancelled: number;
      overdue: number;
    };
    window: { days: number; from: string; to: string };
    /** Active tasks due inside the window, before the limit was applied. */
    dueSoonCount: number;
    overdue: RealtorTaskItem[];
    dueSoon: RealtorTaskItem[];
  };
  pipeline: {
    total: number;
    /** PROSPECT + VIEWING + OFFER + UNDER_CONTRACT. */
    open: number;
    byStage: Record<CrmTransactionStage, number>;
  };
}

interface InvestorCardBase extends CardBase {
  /** ALL_PORTFOLIOS or PORTFOLIO. */
  scope: 'ALL_PORTFOLIOS' | 'PORTFOLIO' | string;
  portfolioId: number | null;
  portfolioCount: number;
  asOfDate: string;
  totalHoldings: number;
  holdingsUpdatedAt: string | null;
  note: string | null;
}
/** GET /dashboards/investor/occupancy-exposure: owner-reported occupancy and holdings by place. */
export interface InvestorOccupancyExposureCardDTO extends InvestorCardBase {
  occupancyCounts: Partial<Record<HoldingOccupancy, number>>;
  knownOccupancyHoldings: number;
  occupancyCoveragePercent: number | null;
  /** RENTED + VACANT. */
  rentalHoldings: number;
  /** RENTED / (RENTED + VACANT) × 100; null without rental holdings. */
  rentalOccupancyPercent: number | null;
  knownGeographyHoldings: number;
  geographyCoveragePercent: number | null;
  /** HOLDING_COUNT: exposure counts holdings, it is not value-weighted. */
  exposureBasis: string;
  states: PortfolioGeography[];
  counties: PortfolioGeography[];
}
/** GET /dashboards/investor/value-equity-debt: amounts by ownership share; partial when not covered. */
export interface InvestorValueEquityDebtCardDTO extends InvestorCardBase {
  currency: string;
  value: PortfolioMetric;
  debt: PortfolioMetric;
  equity: PortfolioMetric;
  valueCoveragePercent: number | null;
  debtCoveragePercent: number | null;
  equityCoveragePercent: number | null;
  oldestBalanceDate: string | null;
  newestBalanceDate: string | null;
  oldestValuationDate: string | null;
  newestValuationDate: string | null;
  valuationSources: string[];
  valuationSource: string;
  debtSource: string;
}
