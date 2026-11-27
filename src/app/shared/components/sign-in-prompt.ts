import { Component, inject, input } from '@angular/core';
import { Workspace } from '../data/workspace';

let next = 0;

/**
 * What a guest sees instead of a page whose data needs an account (the backend answers 401 to
 * every property, location, parcel and map read without one): what signing in gives, Sign in and
 * Create account, and no request sent. `page` makes the heading the page's h1.
 */
@Component({
  selector: 'gz-sign-in-prompt',
  template: `
    <section class="sp" [attr.aria-labelledby]="id">
      @if (page()) {
        <h1 [id]="id">{{ heading() }}</h1>
      } @else {
        <h2 [id]="id">{{ heading() }}</h2>
      }
      <p class="sp-text">{{ text() }}</p>
      <div class="sp-buttons">
        <button type="button" class="btn primary" (click)="w.signIn()">Sign in</button>
        <button type="button" class="btn" (click)="w.signUp()">Create account</button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .sp {
      padding: var(--sp-16) var(--sp-24) var(--sp-24);
      background: var(--surface);
      border-top: 2px solid var(--ink);
      max-width: 720px;
    }
    h1,
    h2 {
      margin: 0;
      font-size: var(--fs-section);
      line-height: var(--lh-section);
    }
    .sp-text {
      margin: var(--sp-8) 0 var(--sp-16);
      font-size: var(--fs-body);
      color: var(--ink-2);
      max-width: var(--measure);
    }
    .sp-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-8);
    }
  `,
})
export class SignInPrompt {
  readonly w = inject(Workspace);
  readonly heading = input.required<string>();
  readonly text = input.required<string>();
  readonly page = input(false);
  readonly id = 'sp-title-' + next++;
}
