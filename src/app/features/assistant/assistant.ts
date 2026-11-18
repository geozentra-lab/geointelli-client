import { Component } from '@angular/core';
import { Unavailable } from '../../shared/components/unavailable';
@Component({
  imports: [Unavailable],
  template: `<gz-unavailable
    title="AIZentra"
    description="Conversations will be available when the assistant service is connected."
  />`,
})
export class Assistant {}
