export interface ExtraFeature {
  actualYearBuilt: number | null;
  adjustedUnitPrice: number | null;
  depreciatedValue: number | null;
  description: string | null;
  message: string | null;
  percentCondition: number | null;
  rollYear: number | null;
  units: number | null;
  useCode: string | null;
}
/** GET /api/properties/id/{id}/extra-features: one roll year (the latest by default) or the full history. */
export interface PropertyExtraFeatures {
  propertyId: number;
  rollYear: number | null;
  history: boolean;
  features: ExtraFeature[];
  /** Paging: history answers only (one roll year is sent whole, and nulls are left out). */
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}
