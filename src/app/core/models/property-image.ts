/** Matches PropertyImageDTO. storagePath is the backend's signed display URL. */
export interface PropertyImage {
  id: number;
  storagePath: string;
  displayOrder: number | null;
  primaryImage: boolean | null;
  source: string | null;
  sourceImageId: string | null;
  sourceUrl: string | null;
  contributor: string | null;
  license: string | null;
  capturedAt: string | null;
  matchStatus: string | null;
}
