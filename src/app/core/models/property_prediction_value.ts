/**
 * GET /api/predictions/bypropertyid and POST /api/predictions/bulk (property-service). One row per
 * property, written monthly by geointelli-models score_all.py: v17 current value, v18 forecasts.
 */
export interface PropertyValuePrediction {
  propertyId: number;

  /** Current value estimate; low/high is the 80% range, the *90 fields the 90% range. */
  predictedPrice: number;
  predictedPriceLow: number;
  predictedPriceHigh: number;
  predictedPriceLow90?: number | null;
  predictedPriceHigh90?: number | null;
  /** Change from the last sale to the estimate, in percent. The server sends 0 when there is no sale. */
  growthPercentage: number;
  /** high / medium / low, from segment-level validation accuracy. */
  confidence?: 'high' | 'medium' | 'low' | string | null;
  /** 90 / 70 / 40. */
  confidenceScore: number;
  /** False when no qualified sale is on record: the estimate then relies on attributes and nearby sales. */
  hasSaleHistory?: boolean | null;

  lastSalePrice: number | null;
  lastSaleDate: string | null;

  /** Forecasts. Null for non-residential properties and properties without coordinates. */
  forecast1y?: number | null;
  forecast1yLow?: number | null;
  forecast1yHigh?: number | null;
  /** 1-year value from the market trend alone, without the property-specific adjustment. */
  unchangedHomeValue1y?: number | null;
  forecast3y?: number | null;
  forecast3yLow?: number | null;
  forecast3yHigh?: number | null;
  forecast7y?: number | null;
  forecast7yLow?: number | null;
  forecast7yHigh?: number | null;
  /** County-wide 1-year market outlook in percent (the same for every property in a run). */
  marketOutlook1yPct?: number | null;

  predictionDate: string;
  /** Last sale date present in the training data. */
  dataThrough?: string | null;
  modelVersion: string;
  /** JSON array of display caveats, e.g. '["No qualified sale history: …"]'. */
  notes?: string | null;
}

export type PredictionMap = Record<string, PropertyValuePrediction>;

/** True when growthPercentage is meaningful (the server reports 0 when there is no prior sale). */
export function hasGrowth(
  p: PropertyValuePrediction | null | undefined,
): p is PropertyValuePrediction {
  return !!p && (p.lastSalePrice ?? 0) > 0 && Number.isFinite(p.growthPercentage);
}

/** The caveats stored in notes, tolerating a plain string or malformed JSON. */
export function predictionNotes(p: PropertyValuePrediction | null | undefined): string[] {
  const raw = p?.notes?.trim();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.filter((n): n is string => typeof n === 'string' && !!n);
    return typeof parsed === 'string' && parsed ? [parsed] : [];
  } catch {
    return [raw];
  }
}
