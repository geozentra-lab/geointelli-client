import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTestStore } from '../../../store';
import { Map } from './map';
describe('Live parcel explorer', () => {
  it('can be created with the shared store', () => {
    TestBed.configureTestingModule({
      imports: [Map],
      providers: [provideRouter([]), provideHttpClient(), ...provideTestStore()],
    });
    const fixture = TestBed.createComponent(Map);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
