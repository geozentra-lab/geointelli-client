import { Component } from '@angular/core';
import { BuyerDashboard } from './buyer-dashboard/buyer-dashboard';

/**
 * Overview (DESIGN.md §5, §8): the home overview, the same for every account (backend SCRUM-204:
 * every account keeps the home-buyer experience) and for guests, whose lead asks them to sign in.
 * Each professional area has its own overview under this route: /dashboard/investments,
 * /dashboard/crm and /dashboard/lending, each behind its feature.
 */
@Component({
  imports: [BuyerDashboard],
  template: `<gz-buyer-dashboard />`,
})
export class Dashboard {}
