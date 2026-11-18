import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
/** Cancels in-flight API work when identity changes, without permanently completing effects. */
@Injectable({ providedIn: 'root' })
export class SessionEvents {
  private ended = new Subject<void>();
  readonly ended$ = this.ended.asObservable();
  end() {
    this.ended.next();
  }
}
