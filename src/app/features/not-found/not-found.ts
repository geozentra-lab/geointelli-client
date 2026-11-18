import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeading } from '../../shared/components/page-heading';

/** Shown for unknown links instead of silently redirecting, so a broken link is recognisable. */
@Component({
  imports: [RouterLink, PageHeading],
  template: `<gz-heading
      eyebrow="NOT FOUND"
      title="We couldn't find that page."
      subtitle="The link may be outdated or mistyped."
    />
    <div class="empty">
      Try one of these instead.
      <div class="actions spacer">
        <a class="btn primary" routerLink="/dashboard">Overview</a
        ><a class="btn" routerLink="/explore">Explore properties</a
        ><a class="btn" routerLink="/saved">Saved & searches</a>
      </div>
    </div>`,
})
export class NotFound {}
