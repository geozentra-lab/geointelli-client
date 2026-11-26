import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Kpi, StageBars } from './dash-ui';
import { MixBar, shareText } from './overview-ui';

function kpi(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({ imports: [Kpi], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Kpi);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('Summary strip figure (gz-kpi)', () => {
  it('shows a missing value as Unavailable on the hatch, with the reason as its caption', () => {
    const el = kpi({ label: 'Approved this month', value: null, unavailable: 'Create your organization first' });
    expect(el.querySelector('.kpi-value.na')).toBeTruthy();
    expect(text(el.querySelector('.kpi-value'))).toBe('Unavailable');
    expect(text(el.querySelector('.kpi-caption'))).toBe('Create your organization first');
    expect(el.textContent).not.toContain('—');
    // Not a tile: no icon square.
    expect(el.querySelector('.kpi-icon, gz-icon')).toBeNull();
  });

  it('keeps a recorded zero as a figure', () => {
    const el = kpi({ label: 'Funded', value: '$0', caption: 'Paid in cash' });
    expect(text(el.querySelector('.kpi-value'))).toBe('$0');
    expect(el.querySelector('.kpi-value.na')).toBeNull();
  });

  it('labels a partial figure and draws its coverage from the backend counts', () => {
    const el = kpi({
      label: 'Portfolio value',
      value: '$1.20M',
      coverage: { covered: 3, total: 5, noun: 'holdings valued' },
    });
    expect(text(el.querySelector('.kpi-caption'))).toBe('Partial: 3 of 5 holdings valued');
    expect(el.querySelector('.partial-word')).toBeTruthy();
    expect((el.querySelector('.covbar i') as HTMLElement).style.width).toBe('60%');
  });

  it('is one entry of the strip definition list; a link names the figure and covers it', () => {
    const el = kpi({ label: 'Value', value: '$1.20M', caption: '2 of 2 holdings valued', link: '/portfolio' });
    expect(el.tagName).toBe('DIV');
    expect(text(el.querySelector('dt.kpi-label'))).toBe('Value');
    expect(el.querySelector('dd.kpi-value')!.textContent!.trim()).toBe('$1.20M');
    expect(text(el.querySelector('dd.kpi-caption'))).toBe('2 of 2 holdings valued');
    expect(el.querySelector('dt a.kpi-link')!.getAttribute('href')).toBe('/portfolio');
  });

  it('gives a caption written as "Partial: …" the Partial label', () => {
    const el = kpi({ label: 'Portfolio value', value: '$1.20M', caption: 'Partial: 3 of 5 holdings valued' });
    expect(text(el.querySelector('.kpi-caption'))).toBe('Partial: 3 of 5 holdings valued');
    expect(text(el.querySelector('.partial-word'))).toBe('Partial:');
  });
});

describe('Pipeline bars (gz-stage-bars)', () => {
  it('steps open stages through the ordinal ramp, mutes lost stages, and never shows a dash', () => {
    TestBed.configureTestingModule({ imports: [StageBars], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StageBars);
    fixture.componentRef.setInput('rows', [
      { key: 'SUBMITTED', label: 'Submitted', count: 4, amount: 1_250_000 },
      { key: 'UNDER_REVIEW', label: 'Under review', count: 2, amount: null },
      { key: 'REJECTED', label: 'Rejected', count: 1, amount: 300_000, muted: true },
    ]);
    fixture.componentRef.setInput('link', '/loan-review');
    fixture.componentRef.setInput('param', 'stage');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const items = [...el.querySelectorAll<HTMLElement>('.stages li')];
    expect(items[0].style.getPropertyValue('--stage-color')).toBe('var(--chart-ord-1)');
    expect(items[1].style.getPropertyValue('--stage-color')).toBe('var(--chart-ord-2)');
    expect(items[2].classList).toContain('muted');
    expect(text(items[1].querySelector('.stage-amount'))).toBe('Unavailable');
    expect(el.textContent).not.toContain('—');
    expect(el.querySelector('.stages a')!.getAttribute('href')).toBe('/loan-review?stage=SUBMITTED');
  });
});

describe('Segmented bar (gz-mix-bar)', () => {
  function bar(parts: unknown[]) {
    TestBed.configureTestingModule({ imports: [MixBar] });
    const fixture = TestBed.createComponent(MixBar);
    fixture.componentRef.setInput('parts', parts);
    fixture.componentRef.setInput('label', 'Funded loans by loan type');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('draws parts in proportion, nothing for a zero part, and the unknown part on the hatch', () => {
    const el = bar([
      { key: 'CONVENTIONAL', label: 'Conventional', value: 3, color: 'var(--chart-cat-1)' },
      { key: 'FHA', label: 'FHA', value: 0, color: 'var(--chart-cat-2)' },
      { key: 'UNKNOWN', label: 'Loan type not recorded', value: 1, color: null },
    ]);
    const parts = [...el.querySelectorAll<HTMLElement>('.mix-part')];
    expect(parts.length).toBe(2);
    expect(parts[0].style.flexGrow).toBe('3');
    expect(parts[1].classList).toContain('na');
    expect(el.querySelector('.mix-bar')!.getAttribute('aria-label')).toBe(
      'Funded loans by loan type. Conventional 3, 75%. Loan type not recorded 1, 25%',
    );
  });
  it('writes shares from the counts, a sliver as under 1%', () => {
    expect([shareText(1, 4), shareText(1, 300), shareText(0, 4), shareText(2, 0)]).toEqual([
      '25%',
      '<1%',
      '0%',
      '',
    ]);
  });
});
