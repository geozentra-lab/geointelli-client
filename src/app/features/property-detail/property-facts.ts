import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Property } from '../../core/models/property';
import { amount } from '../../core/models/property-valuation';
import { RECORD_KIT } from '../../shared/components/record';

/** Why a county-record value is missing; written once per group, under its rows. */
export const NOT_IN_RECORD = 'Not in the county record';
const GROUP_NOTE = 'Unavailable: not in the county record.';

const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * The county record as ruled groups (DESIGN.md §1, §12): building, land, the record itself and the
 * owners. A missing value is the Unavailable marker, with the reason written once under its group;
 * a recorded zero stays a zero. Used by the property page and the live-map dialog.
 */
@Component({
  selector: 'gz-property-facts',
  imports: [DecimalPipe, ...RECORD_KIT],
  template: `
    @let f = facts();
    <gz-record-section heading="Property facts">
      <p class="pf-meta">From {{ f.source }}.</p>
      <div class="groups">
        <gz-record-group heading="Building" [note]="f.buildingNote">
          <div gz-record-row label="Bedrooms" [missing]="f.beds === null" [reason]="reason" [numeric]="true">{{ f.beds }}</div>
          <div gz-record-row label="Bathrooms" [missing]="f.baths === null" [reason]="reason" [numeric]="true">{{ f.baths }}</div>
          <div gz-record-row label="Living area" [missing]="f.living === null" [reason]="reason" [numeric]="true">
            {{ f.living | number }} sq ft
          </div>
          <div gz-record-row label="Year built" [missing]="f.built === null" [reason]="reason" [numeric]="true">{{ f.built }}</div>
          <div gz-record-row label="Floors" [missing]="f.floors === null" [reason]="reason" [numeric]="true">{{ f.floors }}</div>
          @if (f.units !== null && f.units > 1) {
            <div gz-record-row label="Units" [numeric]="true">{{ f.units }}</div>
          }
        </gz-record-group>
        <gz-record-group heading="Land" [note]="f.landNote">
          <div gz-record-row label="Lot" [missing]="f.lot === null" [reason]="reason" [numeric]="true">
            {{ f.lot | number }} sq ft
          </div>
          <div gz-record-row label="Frontage and depth" [missing]="f.frontage === null" [reason]="reason" [numeric]="true">
            {{ f.frontage }}
          </div>
          <div gz-record-row label="Zoning" [missing]="f.zoning === null" [reason]="reason">{{ f.zoning }}</div>
          <div gz-record-row label="Subdivision" [missing]="f.subdivision === null" [reason]="reason">{{ f.subdivision }}</div>
          <div gz-record-row label="Municipality" [missing]="f.municipality === null" [reason]="reason">{{ f.municipality }}</div>
        </gz-record-group>
        <gz-record-group heading="County record" [note]="f.recordNote">
          <div gz-record-row label="Property use" [missing]="f.use === null" [reason]="reason">{{ f.use }}</div>
          <div gz-record-row label="Neighborhood" [missing]="f.neighborhood === null" [reason]="reason">{{ f.neighborhood }}</div>
          <div gz-record-row label="Status" [missing]="f.status === null" [reason]="reason">{{ f.status }}</div>
        </gz-record-group>
        <gz-record-group heading="Owners" [note]="f.ownersNote">
          @for (o of f.owners; track $index) {
            <div
              gz-record-row
              [label]="o.name"
              [missing]="o.share === null"
              reason="Share not in the county record"
              [numeric]="true"
            >
              {{ o.share }}
            </div>
          }
        </gz-record-group>
      </div>
    </gz-record-section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .pf-meta {
      margin: 0 0 var(--sp-8);
      font-size: var(--fs-cell);
      line-height: var(--lh-cell);
      color: var(--ink-2);
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-8) var(--sp-32);
    }
    @media (max-width: 700px) {
      .groups {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PropertyFacts {
  readonly property = input.required<Property>();
  readonly reason = NOT_IN_RECORD;

  readonly facts = computed(() => {
    const p = this.property();
    const beds = amount(p.bedroomCount);
    const full = amount(p.bathroomCount);
    const half = amount(p.halfBathroomCount);
    const baths = full === null ? null : half ? `${full}, ${half} half` : String(full);
    // The same field as property cards, Compare and the units table (property-adapter.ts).
    const living = amount(p.buildingActualArea);
    const built = text(p.yearBuilt);
    const floors = amount(p.floorCount);
    const land = p.lands?.[0];
    const front = amount(land?.frontFeet),
      depth = amount(land?.depth);
    const frontage =
      front !== null && depth !== null && front > 0 && depth > 0
        ? `${front.toLocaleString('en-US')} ft by ${depth.toLocaleString('en-US')} ft`
        : null;
    const lot = amount(p.lotSize);
    const zoning = text(p.primaryZoneDescription);
    const subdivision = text(p.subdivision);
    const municipality = text(p.municipality);
    const use = text(p.dorDescription);
    const neighborhood = text(p.neighborhoodDescription);
    const status = text(p.status);
    const note = (...values: unknown[]) => (values.some((v) => v === null) ? GROUP_NOTE : '');
    const owners = (p.owners ?? []).map((o) => {
      const share = amount(o.percentageOwn);
      const name = text(o.name) ?? 'Name not in the record';
      const role = text(o.role);
      return {
        name: role && role.toLowerCase() !== 'owner' ? `${name}, ${role}` : name,
        share: share === null ? null : `${+share.toFixed(2)}%`,
      };
    });
    return {
      source: p.countyName
        ? `the ${p.countyName} property appraiser's record`
        : "the county property appraiser's record",
      beds,
      baths,
      living,
      built,
      floors,
      units: amount(p.unitCount),
      buildingNote: note(beds, baths, living, built, floors),
      lot,
      frontage,
      zoning,
      subdivision,
      municipality,
      landNote: note(lot, frontage, zoning, subdivision, municipality),
      use,
      neighborhood,
      status,
      recordNote: note(use, neighborhood, status),
      owners,
      ownersNote: !owners.length
        ? 'No owners are listed in the county record.'
        : owners.some((o) => o.share === null)
          ? 'Unavailable: share not in the county record.'
          : '',
    };
  });
}
