import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from '@ngrx/store';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { PropertySearchItem } from '../../core/models/api';
import { ShellSearch } from './shell-search';

const home = (id: number, address: string) =>
  ({ id, address, folio: '0141370120450', city: 'Miami', stateCode: 'FL', zip: '33133' }) as PropertySearchItem;

function setup() {
  TestBed.configureTestingModule({
    imports: [ShellSearch],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...provideTestStore(),
      { provide: KeycloakService, useValue: { isLoggedIn: () => false, hasRealmRole: () => false } },
    ],
  });
  const fixture = TestBed.createComponent(ShellSearch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('#shell-search-input')!;
  input.dispatchEvent(new Event('focus'));
  input.value = 'SW 27th';
  input.dispatchEvent(new Event('input'));
  TestBed.inject(Store).dispatch(
    CatalogActions.lookupLoaded({
      key: 'shell-search',
      query: 'SW 27th',
      items: [home(42, '2847 SW 27th Ter'), home(43, '2861 SW 27th Ter'), home(44, '2901 SW 27th Ter')],
    }),
  );
  fixture.detectChanges();
  return { fixture, el, input };
}
const key = (input: HTMLElement, k: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('Top-bar address search', () => {
  it('lists matches as a listbox and starts Up at the last match, Down at the first', () => {
    const { fixture, el, input } = setup();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('[role=option]')).toHaveLength(3);
    key(input, 'ArrowUp');
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('shell-search-option-2');
    key(input, 'ArrowDown');
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('shell-search-option-0');
    expect(el.querySelector('.search-place')!.textContent).toContain('Folio 01-4137-012-0450');
  });

  it('closes its list when focus leaves by keyboard', () => {
    const { fixture, el, input } = setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[role=listbox]')).toBeNull();
    outside.remove();
  });
});
