import { Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, map, merge, startWith, distinctUntilChanged } from 'rxjs';
@Component({
  selector: 'gz-network-status',
  template: `@if (!online()) {
    <div class="offline-banner" role="status">
      <strong>You're offline.</strong
      ><span>Some actions may be unavailable. Reconnect and try again.</span>
    </div>
  }`,
  styles: `
    .offline-banner {
      display: flex;
      gap: var(--sp-8);
      flex-wrap: wrap;
      padding: 8px var(--gutter);
      background: var(--surface);
      color: var(--ink);
      border-bottom: 1px solid var(--rule);
      box-shadow: inset 0 -2px 0 var(--attention);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
    }
    strong {
      color: var(--attention);
      font-weight: 600;
    }
  `,
})
export class NetworkStatus {
  online = toSignal(
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
      startWith(null),
      map(() => navigator.onLine),
      distinctUntilChanged(),
    ),
    { initialValue: navigator.onLine },
  );
}
