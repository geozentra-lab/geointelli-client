import { Component, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { SPLASH_MAX_MS, revealWhenFirstPageIsDrawn } from './boot-splash';

@Component({ template: 'First page' })
class FirstPage {}

describe('Start-up splash', () => {
  let splash: HTMLElement;
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('app-root');
    root.setAttribute('inert', '');
    splash = document.createElement('div');
    splash.id = 'gz-boot';
    document.body.append(root, splash);
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'first', component: FirstPage }])] });
  });
  afterEach(() => {
    root.remove();
    splash.remove();
    vi.useRealTimers();
  });

  it('stays over the app until the first page has drawn, then fades and gives the app back', async () => {
    revealWhenFirstPageIsDrawn(TestBed.inject(Router), TestBed.inject(Injector), document);
    expect(splash.classList.contains('is-done')).toBe(false);
    expect(root.hasAttribute('inert')).toBe(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/first');
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(root.hasAttribute('inert')).toBe(false);
    // Faded (opacity in index.html), then removed once the fade is over.
    expect(splash.classList.contains('is-done') || !splash.isConnected).toBe(true);
    await new Promise((r) => setTimeout(r, 350));
    expect(splash.isConnected).toBe(false);
  });

  it('never hides the app for long: it goes after the longest wait even without a first page', () => {
    vi.useFakeTimers();
    revealWhenFirstPageIsDrawn(TestBed.inject(Router), TestBed.inject(Injector), document);
    vi.advanceTimersByTime(SPLASH_MAX_MS - 1);
    expect(root.hasAttribute('inert')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(root.hasAttribute('inert')).toBe(false);
    vi.advanceTimersByTime(400);
    expect(splash.isConnected).toBe(false);
  });

  it('does nothing when there is no splash', () => {
    splash.remove();
    expect(() =>
      revealWhenFirstPageIsDrawn(TestBed.inject(Router), TestBed.inject(Injector), document),
    ).not.toThrow();
    expect(root.hasAttribute('inert')).toBe(true);
  });
});
