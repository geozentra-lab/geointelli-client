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
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
      padding: 12px 20px;
      background: var(--warning-bg);
      color: #5e4514;
      border-bottom: 1px solid var(--warning-line);
      font-size: 13px;
      line-height: 1.5;
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
