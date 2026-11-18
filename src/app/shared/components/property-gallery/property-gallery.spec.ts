import { TestBed } from '@angular/core/testing';
import { PropertyGallery } from './property-gallery';
import { PropertyImage } from '../../../core/models/property-image';
describe('Property gallery', () => {
  it('prioritizes the primary photo, supports navigation, and handles failed image URLs', async () => {
    TestBed.configureTestingModule({ imports: [PropertyGallery] });
    const fixture = TestBed.createComponent(PropertyGallery);
    const image = (id: number, primary: boolean, order: number): PropertyImage => ({
      id,
      primaryImage: primary,
      displayOrder: order,
      storagePath: 'https://images.example.test/' + id + '.webp',
      source: null,
      sourceImageId: null,
      sourceUrl: null,
      contributor: null,
      license: null,
      capturedAt: null,
      matchStatus: null,
    });
    fixture.componentRef.setInput('images', [image(1, false, 0), image(2, true, 2)]);
    await fixture.whenStable();
    expect(fixture.componentInstance.active()?.id).toBe(2);
    (
      fixture.nativeElement.querySelector('[aria-label="Next property photo"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.active()?.id).toBe(1);
    fixture.nativeElement.querySelector('.main-photo').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('This photo is unavailable');
    fixture.componentRef.setInput('images', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No property photos available');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
