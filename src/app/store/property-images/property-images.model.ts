import { PropertyImage } from '../../core/models/property-image';
export interface PropertyImagesState {
  propertyId: number | null;
  images: PropertyImage[];
  loading: boolean;
  error: string | null;
}
