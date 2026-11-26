import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Coverage } from './missing';
import { Reasons } from './reasons';
import { PropertyCard } from './property-card';
import { provideTestStore } from '../../store';
import { KeycloakService } from '../../core/auth/keycloak.service';
import { PropertySearchItem } from '../../core/models/api';
import {
  formatConfidence,
  formatConfidenceValue,
  formatFolio,
  formatLocalDate,
  formatLocalDateTime,
  formatLocalTime,
  formatRecordDate,
  countOf,
  isLowConfidence,
  plainNote,
  plainNotes,
} from '../data/format';
import { ShellLayer, holdShellForDialog } from '../layout/shell-layer';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Action, Store } from '@ngrx/store';
import { vi } from 'vitest';
import { PropertyRef } from './property-ref';
import { CatalogActions } from '../../store/catalog/catalog.actions';
import { Component } from '@angular/core';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('Coverage of a partial figure', () => {
  function coverage(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ imports: [Coverage] });
    const fixture = TestBed.createComponent(Coverage);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('writes "Partial: N of M …" with an ink bar for the covered share', () => {
    const el = coverage({ covered: 3, total: 5, noun: 'holdings valued' });
    expect(text(el)).toBe('Partial: 3 of 5 holdings valued');
    expect((el.querySelector('.covbar i') as HTMLElement).style.width).toBe('60%');
  });
  it('drops the Partial label for a metric that is complete by definition', () => {
    const el = coverage({ covered: 2, total: 5, noun: 'holdings', partial: false, lead: 'From records on' });
    expect(text(el)).toBe('From records on 2 of 5 holdings');
    expect(el.querySelector('.partial-word')).toBeNull();
  });
  it('renders nothing when no record is covered: the figure itself is Unavailable', () => {
    expect(text(coverage({ covered: 0, total: 5, noun: 'holdings valued' }))).toBe('');
  });
});

describe('Recommendation reasons (bug 1)', () => {
  it('shows two reasons, then "+N more", and keeps every reason for screen readers', () => {
    TestBed.configureTestingModule({ imports: [Reasons] });
    const fixture = TestBed.createComponent(Reasons);
    fixture.componentRef.setInput('reasons', [
      'Matches your saved target county: Miami-Dade, FL',
      'Within your budget',
      'Built after 1990',
      '3 or more bedrooms',
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const items = [...el.querySelectorAll('li')];
    expect(items).toHaveLength(4);
    expect(items.filter((li) => !li.classList.contains('sr-only'))).toHaveLength(2);
    expect(text(el.querySelector('.more'))).toBe('+2 more');
    expect(el.querySelector('.tag')).toBeNull();
  });
});

describe('Property card', () => {
  it('marks missing facts Unavailable, gives the reason once, and never prints a dash or "null"', () => {
    TestBed.configureTestingModule({
      imports: [PropertyCard],
      providers: [
        provideRouter([]),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => false, hasRealmRole: () => false } },
      ],
    });
    const fixture = TestBed.createComponent(PropertyCard);
    fixture.componentRef.setInput('home', {
      id: 49,
      folio: '0232060011504',
      address: '1700 Collins Ave, Unit 1504',
      city: 'Miami Beach',
      stateCode: 'FL',
      zip: '33139',
      countyName: 'Miami-Dade',
      bedrooms: 2,
      bathrooms: null,
      livingAreaSqft: 1050,
      yearBuilt: null,
    } as PropertySearchItem);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('dd.na')).toHaveLength(2);
    expect(text(el.querySelector('.cardnote'))).toBe('Unavailable: not in the property record.');
    expect(text(el.querySelector('.propertyfoot .num'))).toBe('Folio 02-3206-001-1504');
    expect(el.textContent).not.toContain('—');
    expect(el.textContent).not.toContain('null');
    expect(el.textContent).toContain('1,050');
  });
});

describe('Display helpers', () => {
  it('writes an instant’s day and time on the viewer’s own clock', () => {
    const now = new Date(2026, 10, 20, 9, 0);
    expect(formatLocalDateTime(new Date(2026, 10, 18, 15, 57), now)).toBe('Nov 18, 3:57 PM');
    expect(formatLocalDateTime(new Date(2025, 9, 16, 9, 5), now)).toBe('Oct 16, 2025, 9:05 AM');
    expect(formatLocalTime(new Date(2026, 10, 18, 0, 30))).toBe('12:30 AM');
    expect(formatLocalDateTime(null)).toBeNull();
    expect(formatLocalTime('not a date')).toBeNull();
  });
  it('prints Miami-Dade folios the way the county does, and leaves others alone', () => {
    expect(formatFolio('0141370120450')).toBe('01-4137-012-0450');
    expect(formatFolio(' 30-2232-007-0001 ')).toBe('30-2232-007-0001');
    expect(formatFolio(null)).toBe('');
  });
  it('writes record dates without the year inside the current year', () => {
    const now = new Date(Date.UTC(2026, 10, 19));
    expect(formatRecordDate('2026-11-18', now)).toBe('Nov 18');
    expect(formatRecordDate('2025-10-16', now)).toBe('Oct 16, 2025');
    expect(formatRecordDate('not a date', now)).toBeNull();
    expect(formatRecordDate(null, now)).toBeNull();
  });
  it('writes an instant on the viewer’s own day, not the UTC one', () => {
    const now = new Date(2026, 10, 19, 12);
    // 11:30 pm local on Nov 18 is already Nov 19 in UTC for anyone west of Greenwich.
    expect(formatLocalDate(new Date(2026, 10, 18, 23, 30), now)).toBe('Nov 18');
    expect(formatLocalDate(new Date(2025, 9, 16, 9), now)).toBe('Oct 16, 2025');
    expect(formatLocalDate('', now)).toBeNull();
  });
  it('pluralises counts', () => {
    expect(countOf(1, 'search', 'searches')).toBe('1 search');
    expect(countOf(3, 'search', 'searches')).toBe('3 searches');
  });
});

const closing = new Subject<void>();
@Component({ template: '' })
class FakeDialog {
  constructor() {
    holdShellForDialog({ beforeClosed: () => closing });
  }
}

describe('Shell layer (bug 2)', () => {
  it('holds the shell while a dialog is open and releases it once, when closing starts', () => {
    TestBed.configureTestingModule({ imports: [FakeDialog] });
    const layer = TestBed.inject(ShellLayer);
    const fixture = TestBed.createComponent(FakeDialog);
    expect(layer.modalOpen()).toBe(true);
    const second = layer.holdModal();
    closing.next();
    expect(layer.modalOpen()).toBe(true);
    second();
    second();
    expect(layer.modalOpen()).toBe(false);
    fixture.destroy();
    expect(layer.modalOpen()).toBe(false);
  });

  it('lets the scrim close the open sheet', () => {
    const layer = TestBed.inject(ShellLayer);
    let closed = 0;
    const release = layer.openSheet(() => closed++);
    expect(layer.sheetOpen()).toBe(true);
    layer.dismissSheet();
    expect(closed).toBe(1);
    release();
    expect(layer.sheetOpen()).toBe(false);
  });
});

describe('Confidence and backend copy (DESIGN.md §9, §13)', () => {
  it('writes confidence as the score with its band, and never works one out from the other', () => {
    expect(formatConfidence(78, 'medium')).toBe('Confidence 78 of 100 · Medium');
    expect(formatConfidence(78, null)).toBe('Confidence 78 of 100');
    expect(formatConfidence(null, 'LOW')).toBe('Low confidence');
    expect(formatConfidence(undefined, '')).toBe('Confidence not stated');
    expect(formatConfidenceValue(70.4, 'high')).toBe('70 of 100 · High');
    expect(formatConfidenceValue(null, null)).toBeNull();
    expect(isLowConfidence(' Low ')).toBe(true);
    expect(isLowConfidence('medium')).toBe(false);
  });

  it('writes field names in backend copy in the page’s words, or leaves the note out', () => {
    expect(
      plainNote(
        'Missing data cannot raise a score. coveragePercent is the highest score the available evidence allows.',
      ),
    ).toBe(
      'Missing data cannot raise a score. Evidence coverage is the highest score the available evidence allows.',
    );
    expect(
      plainNote(
        "Source freshness is unavailable; generatedAt is the response time, not the property data's observation time.",
      ),
    ).toBe(
      "Source freshness is unavailable; the “Updated” date is the response time, not the property data's observation time.",
    );
    expect(plainNote('generatedAt is the response time.')).toBe('The “Updated” date is the response time.');
    // Any other field name: the note is left out rather than shown as code.
    expect(plainNote('Records as of sourceAsOf.')).toBeNull();
    expect(plainNote('See last_error_code.')).toBeNull();
    // Product names and plain words stay.
    expect(plainNote('ZentraValue is an estimate, not an asking price.')).toBe(
      'ZentraValue is an estimate, not an asking price.',
    );
    expect(plainNotes(['Informational only.', 'Uses lastErrorCode.', null])).toEqual(['Informational only.']);
  });
});

describe('Property reference', () => {
  it('asks for each property once, not again whenever another one arrives', async () => {
    @Component({
      imports: [PropertyRef],
      template: `<gz-property-ref [propertyId]="42" /><gz-property-ref [propertyId]="43" [link]="false" />`,
    })
    class Host {}
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTestStore(),
        { provide: KeycloakService, useValue: { isLoggedIn: () => false, hasRealmRole: () => false } },
      ],
    });
    const store = TestBed.inject(Store);
    const asked: number[] = [];
    const dispatch = store.dispatch.bind(store);
    vi.spyOn(store, 'dispatch').mockImplementation(((a: Action & { id?: number }) => {
      if (a.type === CatalogActions.resolveProperty.type) asked.push(a.id!);
      return dispatch(a);
    }) as Store['dispatch']);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(asked).toEqual([42, 43]);
    store.dispatch(CatalogActions.cacheItems({ items: [{ id: 43, address: '640 NE 74th St', folio: '0131180000000' } as PropertySearchItem] }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(asked).toEqual([42, 43]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('640 NE 74th St');
    // Still on its way: a skeleton, never "Property #42". Failed: said in words.
    expect(el.querySelector('.pr-skel')).not.toBeNull();
    expect(el.textContent).not.toContain('#42');
    store.dispatch(CatalogActions.resolveFailed({ id: 42 }));
    fixture.detectChanges();
    expect(el.querySelector('a.pr-na')!.textContent!.trim()).toBe(
      'Address unavailable: the record could not load; open it to try again',
    );
    expect(el.querySelector('a.pr-na .sr-only')).not.toBeNull();
    expect(asked).toEqual([42, 43]);
  });
});

