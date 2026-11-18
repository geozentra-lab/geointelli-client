import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { PropertySearchItem } from '../../core/models/api';
@Component({
  selector: 'gz-property-table',
  imports: [RouterLink, DecimalPipe],
  template: `<div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>Property</th>
          <th>County</th>
          <th>Living area</th>
        </tr>
      </thead>
      <tbody>
        @for (h of homes(); track h.id) {
          <tr>
            <td>
              <a [routerLink]="['/property', h.id]">{{ h.address || h.folio }}</a>
            </td>
            <td>{{ h.countyName || '—' }}</td>
            <td>{{ h.livingAreaSqft == null ? '—' : (h.livingAreaSqft | number) }} sqft</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="3">No property records available.</td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
})
export class PropertyTable {
  homes = input.required<PropertySearchItem[]>();
}
