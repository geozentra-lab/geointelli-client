import { LoadingSpinner } from '../../shared/components/loading-spinner';
import { Component, effect, input, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { Icon } from '../../shared/components/icon/icon';
import { DashboardActions } from '../../store/dashboard/dashboard.actions';
import { selectDashboard } from '../../store/dashboard/dashboard.selectors';
@Component({
  selector: 'gz-dashboard-overview',
  imports: [LoadingSpinner, RouterLink, DatePipe, Icon],
  template: `@if (!w.auth.isLoggedIn()) {
      <div class="panel section guest-notice">
        <h3>Make this workspace yours.</h3>
        <p class="sub spacer">
          Sign in to save properties, monitor searches and get suggestions matched to your goals.
          You can keep browsing property records as a guest.
        </p>
        <button type="button" class="btn primary spacer" (click)="w.signIn()">Sign in</button>
      </div>
    } @else {
      <!-- Cards need the account; if /users/me failed, the page-level error explains why. -->
      @if (w.account().profile || !w.account().error) {
        <div class="grid cols3 section">
          <section class="panel card" aria-labelledby="card-favorites">
            <div class="panelhead">
              <h3 id="card-favorites">Saved properties</h3>
              <a class="smalltext" routerLink="/saved">View all</a>
            </div>
            @if (d().favorites; as c) {
              @if (c.loading && !c.value) {
                <gz-loading-spinner [compact]="true" label="Loading saved properties" />
              } @else if (c.error) {
                <p class="sub" role="alert">{{ c.error }}</p>
                <button type="button" class="btn small" (click)="reload()">Retry</button>
              } @else if (c.value; as card) {
                @if (!compact()) {
                  <p class="count">{{ card.count }}</p>
                }
                @for (f of card.recent; track f.propertyId) {
                  <a class="recent" [routerLink]="['/property', f.propertyId]"
                    ><span>{{ f.address || 'Folio ' + f.folio }}</span
                    ><span class="smalltext muted">{{
                      f.favoritedAt | date: 'mediumDate'
                    }}</span></a
                  >
                } @empty {
                  <p class="sub">Tap the heart on any property to keep it here.</p>
                }
              }
            }
          </section>
          <section class="panel card" aria-labelledby="card-searches">
            <div class="panelhead">
              <h3 id="card-searches">Saved searches</h3>
              <a class="smalltext" routerLink="/saved">Manage</a>
            </div>
            @if (d().savedSearches; as c) {
              @if (c.loading && !c.value) {
                <gz-loading-spinner [compact]="true" label="Loading saved searches" />
              } @else if (c.error) {
                <p class="sub" role="alert">{{ c.error }}</p>
                <button type="button" class="btn small" (click)="reload()">Retry</button>
              } @else if (c.value; as card) {
                @if (!compact()) {
                  <p class="count">{{ card.count }}</p>
                }
                @for (s of card.recent; track s.id) {
                  <a class="recent" routerLink="/saved"
                    ><span>{{ s.name }}</span
                    ><span class="tag" [class.amber]="s.paused">{{
                      s.paused ? 'Paused' : s.cadence === 'DAILY' ? 'Daily' : 'Weekly'
                    }}</span></a
                  >
                } @empty {
                  <p class="sub">Save a search in Explore to get notified about new matches.</p>
                }
              }
            }
          </section>
          <section class="panel card" aria-labelledby="card-alerts">
            <div class="panelhead">
              <h3 id="card-alerts">Alert rules</h3>
              <a class="smalltext" routerLink="/alerts">Manage</a>
            </div>
            @if (d().alerts; as c) {
              @if (c.loading && !c.value) {
                <gz-loading-spinner [compact]="true" label="Loading alert rules" />
              } @else if (c.error) {
                <p class="sub" role="alert">{{ c.error }}</p>
                <button type="button" class="btn small" (click)="reload()">Retry</button>
              } @else if (c.value; as card) {
                <p class="count" [hidden]="compact()">
                  {{ card.count }}
                  @if (card.count) {
                    <span class="smalltext muted"
                      >{{ card.activeCount }} active · {{ card.pausedCount }} paused</span
                    >
                  }
                </p>
                @for (a of card.recent; track a.id) {
                  <a class="recent" routerLink="/alerts"
                    ><span>{{ a.name }}</span
                    ><span class="tag" [class.amber]="a.effectivePaused">{{
                      a.effectivePaused ? 'Paused' : 'Active'
                    }}</span></a
                  >
                } @empty {
                  <p class="sub">Create a rule to be told when a saved search finds new matches.</p>
                }
              }
            }
          </section>
        </div>
      }
    }
    <div class="grid cols3 section">
      @for (link of shortcuts; track link.path) {
        <a class="panel shortcut trace" [routerLink]="link.path"
          ><gz-icon [name]="link.icon" />
          <div>
            <h3>{{ link.title }}</h3>
            <p class="sub">{{ link.text }}</p>
          </div></a
        >
      }
    </div>`,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .count {
      font-size: 30px;
      font-weight: 700;
      margin: 4px 0 8px;
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .recent {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
    .recent span:first-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .shortcut {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
  `,
})
export class DashboardOverview {
  /** Counts are shown as KPI tiles above, so the cards list recent items only. */
  compact = input(false);
  w = inject(Workspace);
  d = this.w.store.selectSignal(selectDashboard);
  readonly shortcuts = [
    {
      path: '/opportunities',
      icon: 'chart',
      title: 'Opportunities',
      text: 'Property records matched to your saved counties and budget.',
    },
    {
      path: '/investment-studio',
      icon: 'wallet',
      title: 'Affordability & payments',
      text: 'Estimate your budget and model monthly ownership costs.',
    },
    {
      path: '/compare',
      icon: 'compare',
      title: 'Compare properties',
      text: 'Put up to five properties side by side.',
    },
    {
      path: '/explore',
      icon: 'search',
      title: 'Research properties',
      text: 'Search county records and inspect property evidence.',
    },
    {
      path: '/portfolio',
      icon: 'brief',
      title: 'Your portfolios',
      text: 'Review holdings, recorded cash flow and data coverage.',
    },
    {
      path: '/crm',
      icon: 'user',
      title: 'Clients & deals',
      text: 'Track clients, leads, tasks and your deal pipeline.',
    },
  ];
  constructor() {
    // Wait for /users/me: on a brand-new account it provisions the user, and firing the cards in
    // parallel would race that first-login creation.
    effect(() => {
      const userId = this.w.account().profile?.id;
      if (userId !== undefined && userId !== this.loadedFor) {
        this.loadedFor = userId;
        untracked(() => this.reload());
      }
    });
  }
  private loadedFor: number | undefined;
  reload() {
    this.w.store.dispatch(DashboardActions.load());
  }
}
