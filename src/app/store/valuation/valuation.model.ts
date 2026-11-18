import {
  PredictionMap,
  PropertyValuePrediction,
} from '../../core/models/property_prediction_value';
import { PropertyValuation } from '../../core/models/property-valuation';
/** The explained valuation of one property; every field belongs to propertyId. */
export interface ValuationDetailState {
  propertyId: number | null;
  valuation: PropertyValuation | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}
export interface ValuationState {
  prediction: PropertyValuePrediction | null;
  predictions: PredictionMap;
  loading: boolean;
  bulkLoading: boolean;
  error: string | null;
  bulkError: string | null;
  detail: ValuationDetailState;
}
