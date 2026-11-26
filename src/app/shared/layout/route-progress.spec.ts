import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ROUTE_PROGRESS_DELAY_MS, RouteProgress } from './route-progress';

@Component({ template: '' })
class Blank {}

describe('Route progress line', () => {
  let release: () => void = () => {};
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'fast', component: Blank },
          {
            path: 'slow',
            component: Blank,
            canActivate: [() => new Promise<boolean>((resolve) => (release = () => resolve(true)))],
          },
        ]),
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('stays hidden for a page change that is quicker than its delay', async () => {
    const fixture = TestBed.createComponent(RouteProgress);
    const done = TestBed.inject(Router).navigateByUrl('/fast');
    await vi.advanceTimersByTimeAsync(10);
    await done;
    await vi.advanceTimersByTimeAsync(ROUTE_PROGRESS_DELAY_MS * 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rp-line.on')).toBeNull();
    expect(fixture.componentInstance.progress()).toBe(0);
  });

  it('creeps while a slow page loads without claiming it is done, then fills and fades', async () => {
    const fixture = TestBed.createComponent(RouteProgress);
    const done = TestBed.inject(Router).navigateByUrl('/slow');
    await vi.advanceTimersByTimeAsync(ROUTE_PROGRESS_DELAY_MS + 1000);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.rp-line') as HTMLElement;
    expect(bar.classList).toContain('on');
    const partial = fixture.componentInstance.progress();
    expect(partial).toBeGreaterThan(0.08);
    expect(partial).toBeLessThan(0.9);

    release();
    await done;
    expect(fixture.componentInstance.progress()).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    expect(bar.classList).not.toContain('on');
    expect(fixture.componentInstance.progress()).toBe(0);
  });
});
