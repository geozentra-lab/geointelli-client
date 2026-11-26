import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { PropertyCompareActions } from '../../store/property-compare/property-compare.actions';
import { selectCompareSelection } from '../../store/property-compare/property-compare.selectors';
import { COMPARE_MAX } from '../../store/property-compare/property-compare.reducer';
import { selectUi } from '../../store/ui/ui.selectors';
import { CompareToggle } from './compare-toggle';

describe('Compare toggle as a table checkbox', () => {
  function setup(propertyId: number) {
    TestBed.configureTestingModule({
      imports: [CompareToggle],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideTestStore()],
    });
    const store = TestBed.inject(Store);
    const fixture = TestBed.createComponent(CompareToggle);
    fixture.componentRef.setInput('propertyId', propertyId);
    fixture.componentRef.setInput('label', '2847 SW 27th Ter');
    fixture.componentRef.setInput('check', true);
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    return { store, fixture, box };
  }

  it('adds and removes the property, named for screen readers', () => {
    const { store, fixture, box } = setup(42);
    expect(box.getAttribute('aria-label')).toBe('Compare 2847 SW 27th Ter');
    box.click();
    fixture.detectChanges();
    expect(store.selectSignal(selectCompareSelection)()).toEqual([42]);
    expect(box.checked).toBe(true);
    box.click();
    fixture.detectChanges();
    expect(store.selectSignal(selectCompareSelection)()).toEqual([]);
    expect(box.checked).toBe(false);
  });

  it('stays unchecked and says why when the comparison is full', () => {
    const { store, fixture, box } = setup(99);
    for (let id = 1; id <= COMPARE_MAX; id++) store.dispatch(PropertyCompareActions.toggle({ propertyId: id }));
    fixture.detectChanges();
    box.click();
    fixture.detectChanges();
    expect(box.checked).toBe(false);
    expect(store.selectSignal(selectCompareSelection)()).not.toContain(99);
    expect(store.selectSignal(selectUi)().toast).toContain(`up to ${COMPARE_MAX} properties`);
  });
});
