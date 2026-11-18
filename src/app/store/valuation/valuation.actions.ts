import { createActionGroup, props } from '@ngrx/store';
import {
  PredictionMap,
  PropertyValuePrediction,
} from '../../core/models/property_prediction_value';
import { PropertyValuation } from '../../core/models/property-valuation';
export const ValuationActions = createActionGroup({
  source: 'Valuation API',
  events: {
    Load: props<{ propertyId: number }>(),
    /** prediction is null when the property has no estimate yet (the API answers 404). */
    Loaded: props<{ prediction: PropertyValuePrediction | null }>(),
    Failed: props<{ error: string }>(),
    'Load bulk': props<{ propertyIds: number[] }>(),
    'Bulk loaded': props<{ predictions: PredictionMap }>(),
    'Bulk failed': props<{ error: string }>(),
    /** The explained valuation (GET /properties/id/{id}/valuation) for the property page. */
    'Load detail': props<{ propertyId: number }>(),
    'Detail loaded': props<{ propertyId: number; valuation: PropertyValuation }>(),
    /** notFound: the property itself does not exist (404). */
    'Detail failed': props<{ propertyId: number; error: string; notFound: boolean }>(),
  },
});
