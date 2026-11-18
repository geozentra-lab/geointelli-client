import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Workspace } from '../../shared/data/workspace';
import { PageHeading } from '../../shared/components/page-heading';
import { Icon } from '../../shared/components/icon/icon';
import { RequestStatus } from '../../shared/components/request-status';
import { InvestorDashboard } from './investor-dashboard/investor-dashboard';
import { BuyerDashboard } from './buyer-dashboard/buyer-dashboard';
import { RealtorDashboard } from './realtor-dashboard/realtor-dashboard';
import { LenderDashboard } from './lender-dashboard/lender-dashboard';
@Component({
  imports: [
    RouterLink,
    PageHeading,
    Icon,
    RequestStatus,
    InvestorDashboard,
    BuyerDashboard,
    RealtorDashboard,
    LenderDashboard,
  ],
  template: `<gz-heading
      [eyebrow]="'YOUR ' + w.user().role.toUpperCase() + ' WORKSPACE'"
      [title]="w.user().name ? 'Welcome, ' + w.user().name + '.' : 'Your property workspace'"
      [subtitle]="subtitles[w.user().role]"
      ><a class="btn primary" routerLink="/explore"
        ><gz-icon name="search" />Explore properties</a
      ></gz-heading
    >
    <gz-request-status
      [loading]="w.account().loading"
      loadingText="Loading your account…"
      [error]="w.account().error"
      (retry)="w.reloadUser()"
    />
    @switch (w.user().role) {
      @case ('Buyer') {
        <gz-buyer-dashboard />
      }
      @case ('Investor') {
        <gz-investor-dashboard />
      }
      @case ('Realtor') {
        <gz-realtor-dashboard />
      }
      @case ('Lender') {
        <gz-lender-dashboard />
      }
    } `,
})
export class Dashboard {
  w = inject(Workspace);
  subtitles = {
    Investor: 'A clearer view of your holdings and your next opportunity.',
    Buyer: 'Your next home starts with a better understanding.',
    Realtor: 'The evidence and activity behind your next conversation.',
    Lender: 'Property evidence across your lending pipeline.',
  };
}
