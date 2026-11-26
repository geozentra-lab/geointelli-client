import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { addMonths, axisMoney, linear, monthLabel, timeTicks, zeroBasedTicks } from './scale';

export interface ChartPoint {
  date: Date;
  value: number;
}
export interface ChartBandPoint {
  date: Date;
  low: number;
  high: number;
}
export interface ChartGap {
  from: Date;
  to: Date;
}
/** A forecast value; low and high, when both are known, bound its fan. */
export interface ChartForecastPoint {
  date: Date;
  value: number;
  low: number | null;
  high: number | null;
}
type MarkKind = 'recorded' | 'model' | 'forecast';
interface Mark {
  kind: MarkKind;
  x: number;
  y: number;
  point: ChartPoint;
  label: { above: boolean; anchor: 'start' | 'middle' | 'end' } | null;
}

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
let nextId = 0;

/**
 * A value over time on a linear time axis (DESIGN.md §11): events sit at their true dates, so 2008,
 * 2019 and 2026 are spaced by years. Recorded values (sales) are ink dots joined by an ink line,
 * and the last one is joined to the model by a dashed copper line; model output (the ZentraValue
 * line, its 80% band and the current estimate) is chart copper. Lines draw in once. The y axis starts at
 * 0 with 3-5 round ticks. The chart draws at its container's real width and redraws on resize, so
 * labels stay 12 px on phones. Marks are reachable by keyboard and show a tooltip, but a tooltip is
 * never the only way to read a value: pair the chart with its table twin.
 */
@Component({
  selector: 'gz-time-chart',
  template: `
    @if (legend().length > 1) {
      <ul class="legend">
        @for (l of legend(); track l.kind) {
          <li><span [class]="'swatch ' + l.kind"></span>{{ l.label }}</li>
        }
      </ul>
    }
    <div class="plot" #plot (pointerleave)="leave()">
      @let c = chart();
      <svg
        [attr.width]="c.w"
        [attr.height]="c.h"
        [attr.viewBox]="'0 0 ' + c.w + ' ' + c.h"
        role="group"
        [attr.aria-label]="ariaLabel()"
      >
        <defs>
          <pattern [id]="hatchId" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line class="hatch-line" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
        @for (g of c.gaps; track $index) {
          <rect [attr.x]="g.x" [attr.y]="c.top" [attr.width]="g.w" [attr.height]="c.base - c.top" [attr.fill]="'url(#' + hatchId + ')'" />
          <text class="axis-text" [attr.x]="g.x + g.w / 2" [attr.y]="c.top + 12" text-anchor="middle">No records</text>
        }
        @for (t of c.yTicks; track t.v) {
          @if (t.v > 0) {
            <line class="grid" [attr.x1]="c.left" [attr.x2]="c.w - c.right" [attr.y1]="t.y" [attr.y2]="t.y" />
          }
          <text class="axis-text" [attr.x]="c.left - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.label }}</text>
        }
        <line class="baseline" [attr.x1]="c.left" [attr.x2]="c.w - c.right" [attr.y1]="c.base" [attr.y2]="c.base" />
        @for (t of c.xTicks; track t.label) {
          <line class="baseline" [attr.x1]="t.x" [attr.x2]="t.x" [attr.y1]="c.base" [attr.y2]="c.base + 4" />
          <text class="axis-text" [attr.x]="t.x" [attr.y]="c.base + 18" text-anchor="middle">{{ t.label }}</text>
        }
        @if (c.today !== null) {
          <line class="today" [attr.x1]="c.today" [attr.x2]="c.today" [attr.y1]="c.top - 8" [attr.y2]="c.base" />
          <!-- Labelled just above the baseline, clear of the estimate's label at the top. -->
          <text class="axis-text" [attr.x]="c.today - 4" [attr.y]="c.base - 6" text-anchor="end">Today</text>
        }
        @if (c.band) {
          <path class="band" [attr.d]="c.band" />
        }
        @for (f of c.fan; track $index) {
          <path class="band" [attr.d]="f" />
        }
        @if (c.recordedLine) {
          <path class="recorded-line draw" pathLength="1" [attr.d]="c.recordedLine" />
        }
        @if (c.bridge) {
          <path class="bridge" [attr.d]="c.bridge" />
        }
        @if (c.line) {
          <path class="line draw after-recorded" pathLength="1" [attr.d]="c.line" />
        }
        @if (c.forecastLine) {
          <path class="line draw last" pathLength="1" [attr.d]="c.forecastLine" />
        }
        @if (c.cross !== null) {
          <line class="today" [attr.x1]="c.cross" [attr.x2]="c.cross" [attr.y1]="c.top" [attr.y2]="c.base" />
        }
        @if (c.lineMarks.length) {
          <rect class="hit" [attr.x]="c.left" [attr.y]="c.top" [attr.width]="c.w - c.left - c.right" [attr.height]="c.base - c.top" (pointermove)="track($event)" />
        }
        @for (m of c.marks; track $index) {
          <circle [class]="'dot ' + m.kind" [attr.cx]="m.x" [attr.cy]="m.y" [attr.r]="m.kind === 'recorded' ? 4 : 5" />
          @if (m.label; as l) {
            <text class="label-value" [attr.x]="m.x" [attr.y]="l.above ? m.y - 22 : m.y + 22" [attr.text-anchor]="l.anchor">{{ short(m.point.value) }}</text>
            <text class="axis-text" [attr.x]="m.x" [attr.y]="l.above ? m.y - 9 : m.y + 35" [attr.text-anchor]="l.anchor">{{ month(m.point.date) }}</text>
          }
          <circle
            class="hit"
            [attr.cx]="m.x"
            [attr.cy]="m.y"
            r="12"
            tabindex="0"
            role="img"
            [attr.aria-label]="describe(m)"
            (pointerenter)="hover.set($index)"
            (focus)="hover.set($index)"
            (blur)="hover.set(null)"
          />
        }
      </svg>
      @if (tip(); as t) {
        <div class="tip" [style.left.px]="t.x" [style.top.px]="t.y" [class.below]="t.below" aria-hidden="true">
          <span>{{ t.kind }}</span><b>{{ t.value }}</b><span>{{ t.date }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; font-size: var(--fs-caption); line-height: var(--lh-caption); }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 8px; padding: 0; list-style: none; color: var(--ink-2); }
    .legend li { display: flex; align-items: center; gap: 6px; }
    .swatch { width: 8px; height: 8px; border-radius: 50%; background: var(--chart-recorded); }
    .swatch.model { background: var(--chart-model); }
    .swatch.band,
    .swatch.fan { width: 12px; height: 10px; border-radius: 0; background: var(--chart-model); opacity: 0.24; }
    .swatch.forecast { width: 14px; height: 2px; border-radius: 0; background: var(--chart-model); }
    .plot { position: relative; width: 100%; }
    svg { display: block; overflow: visible; font-variant-numeric: tabular-nums lining-nums; }
    .grid { stroke: var(--rule); }
    .baseline { stroke: var(--rule-strong); }
    .today { stroke: var(--ink-2); }
    .hatch-line { stroke: var(--hatch-line); }
    .axis-text { fill: var(--ink-2); font-size: 12px; }
    .label-value { fill: var(--ink); font-size: 12px; font-weight: 500; }
    .band { fill: var(--chart-model); fill-opacity: 0.16; }
    .line { fill: none; stroke: var(--chart-model); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .recorded-line { fill: none; stroke: var(--chart-recorded); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    /* From the last recorded value to the model: dashed, because nothing was recorded in between. */
    .bridge { fill: none; stroke: var(--chart-model); stroke-width: 2; stroke-dasharray: 6 5; stroke-linecap: round; animation: chart-fade 300ms ease-out 450ms both; }
    /* Lines draw in once, left to right: recorded first, then the model. pathLength="1" makes one
       dash the whole line; with motion off (styles.css) the animation is dropped and the line is
       simply there, because the resting offset is 0. */
    .draw { stroke-dasharray: 1; animation: chart-draw 700ms cubic-bezier(0.2, 0, 0, 1) both; }
    .draw.after-recorded { animation-delay: 500ms; }
    .draw.last { animation-delay: 900ms; }
    @keyframes chart-draw { from { stroke-dashoffset: 1; } }
    @keyframes chart-fade { from { opacity: 0; } }
    .dot { stroke: var(--surface); stroke-width: 2; }
    .dot.recorded { fill: var(--chart-recorded); }
    .dot.model,
    .dot.forecast { fill: var(--chart-model); }
    .hit { fill: transparent; cursor: default; }
    .hit:focus-visible { outline: none; stroke: var(--focus); stroke-width: 2; }
    .tip { position: absolute; z-index: 1; display: flex; flex-direction: column; min-width: 120px; padding: 6px 8px; transform: translate(-50%, calc(-100% - 14px)); background: var(--surface); border: 1px solid var(--rule-strong); box-shadow: var(--shadow-menu); color: var(--ink-2); pointer-events: none; white-space: nowrap; }
    .tip.below { transform: translate(-50%, 14px); }
    .tip b { color: var(--ink); font-size: var(--fs-cell); font-weight: 600; }
  `,
})
export class TimeChart {
  /** Recorded values (sales): ink dots. */
  readonly points = input<readonly ChartPoint[]>([]);
  /** The current model estimate: a labelled copper dot. */
  readonly estimate = input<ChartPoint | null>(null);
  /** Model history (e.g. the monthly ZentraValue): a 2 px copper line with a crosshair. */
  readonly line = input<readonly ChartPoint[]>([]);
  /** Model range (e.g. the 80% band) at 16%. */
  readonly band = input<readonly ChartBandPoint[]>([]);
  /**
   * Forecast values after the estimate (DESIGN.md §11): a 2 px median line from the estimate and,
   * between points that both have bounds, the range fan at 16%. The estimate pinches the fan.
   */
  readonly forecast = input<readonly ChartForecastPoint[]>([]);
  /** Stretches of periodic data with no records: hatched full-height columns. */
  readonly gaps = input<readonly ChartGap[]>([]);
  /** Joins the recorded values with a line, and the last one to the model with a dashed line. */
  readonly connect = input(true);
  readonly recordedLabel = input('Recorded sale');
  readonly modelLabel = input('ZentraValue');
  readonly bandLabel = input('80% range');
  readonly forecastLabel = input('Forecast');
  /** The fan has its own legend entry: forecast bounds are not the 80% range of the history. */
  readonly fanLabel = input('Forecast range, illustrative');
  readonly ariaLabel = input('Values over time');
  readonly height = input(240);
  /** Overrides for the default span (2 years before the first point to 6 months after today). */
  readonly from = input<Date | null>(null);
  readonly to = input<Date | null>(null);
  readonly today = input<Date>(new Date());
  /** Width used before the container has been measured (and in tests). */
  readonly initialWidth = input(640);

  readonly hatchId = 'gz-hatch-' + nextId++;
  readonly hover = signal<number | null>(null);
  private readonly lineHover = signal<number | null>(null);
  private readonly measured = signal<number | null>(null);
  private readonly plot = viewChild.required<ElementRef<HTMLElement>>('plot');

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.plot().nativeElement;
      if (el.clientWidth) this.measured.set(el.clientWidth);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w && w !== this.measured()) this.measured.set(w);
      });
      observer.observe(el);
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  readonly legend = computed(() => {
    const items: { kind: MarkKind | 'band' | 'fan'; label: string }[] = [];
    if (this.points().length) items.push({ kind: 'recorded', label: this.recordedLabel() });
    if (this.estimate() || this.line().length)
      items.push({ kind: 'model', label: this.modelLabel() });
    if (this.band().length > 1) items.push({ kind: 'band', label: this.bandLabel() });
    if (this.forecast().length) items.push({ kind: 'forecast', label: this.forecastLabel() });
    if (this.forecast().some((p) => p.low !== null && p.high !== null))
      items.push({ kind: 'fan', label: this.fanLabel() });
    return items;
  });

  readonly chart = computed(() => {
    const w = Math.max(240, this.measured() ?? this.initialWidth());
    const h = this.height();
    const narrow = w < 480;
    const points = [...this.points()].sort((a, b) => +a.date - +b.date);
    const estimate = this.estimate();
    const line = [...this.line()].sort((a, b) => +a.date - +b.date);
    const band = [...this.band()].sort((a, b) => +a.date - +b.date);
    const forecast = [...this.forecast()].sort((a, b) => +a.date - +b.date);
    const today = this.today();
    const dates = [...points, ...line, ...band, ...forecast, ...(estimate ? [estimate] : [])].map(
      (p) => p.date,
    );
    const first = dates.length ? new Date(Math.min(...dates.map(Number))) : today;
    const last = dates.length ? new Date(Math.max(...dates.map(Number))) : today;
    const from = this.from() ?? addMonths(first, -24);
    const to = this.to() ?? new Date(Math.max(+addMonths(today, 6), +last));
    const values = [
      ...points.map((p) => p.value),
      ...line.map((p) => p.value),
      ...band.map((p) => p.high),
      ...forecast.map((p) => Math.max(p.value, p.high ?? 0)),
      ...(estimate ? [estimate.value] : []),
    ];
    const yTickValues = zeroBasedTicks(Math.max(0, ...values), narrow ? 3 : 4);
    const yLabels = yTickValues.map(axisMoney);
    const left = 10 + Math.max(...yLabels.map((l) => l.length)) * 7;
    const right = 16;
    const top = 40;
    const base = h - 26;
    const x = linear(+from, +to, left, w - right);
    const y = linear(0, yTickValues.at(-1)!, base, top);

    const marks: Mark[] = points.map((p) => ({
      kind: 'recorded',
      x: x(+p.date),
      y: y(p.value),
      point: p,
      label: null,
    }));
    if (estimate)
      marks.push({ kind: 'model', x: x(+estimate.date), y: y(estimate.value), point: estimate, label: null });
    for (const f of forecast)
      marks.push({ kind: 'forecast', x: x(+f.date), y: y(f.value), point: f, label: null });
    // Direct labels, selectively: every event when there are five or fewer, else the ends and the
    // extremes; the estimate always. Labels that would collide flip below their dot.
    const recorded = marks.filter((m) => m.kind === 'recorded');
    const pick = new Set<Mark>(
      recorded.length <= 5
        ? recorded
        : [
            recorded[0],
            recorded.at(-1)!,
            recorded.reduce((a, b) => (b.point.value > a.point.value ? b : a)),
            recorded.reduce((a, b) => (b.point.value < a.point.value ? b : a)),
          ],
    );
    marks.filter((m) => m.kind !== 'recorded').forEach((m) => pick.add(m));
    // Labels never overlap: the most telling ones are placed first (the estimate, the latest, the
    // first, the extremes), each above its dot or else below; one that fits neither is left out
    // (its value stays in the tooltip and the table twin). A label is two 12 px lines, about 30 px
    // tall and as wide as its longer line.
    type Box = { x1: number; x2: number; y1: number; y2: number };
    const placed: Box[] = [];
    const overlaps = (b: Box) =>
      placed.some((p) => b.x1 < p.x2 + 4 && b.x2 > p.x1 - 4 && b.y1 < p.y2 + 2 && b.y2 > p.y1 - 2);
    const priority = (m: Mark) =>
      m.kind === 'model'
        ? 0
        : m === recorded.at(-1)
          ? 1
          : m === recorded[0]
            ? 2
            : m.kind === 'forecast'
              ? 4
              : 3;
    for (const m of [...pick].sort((a, b) => priority(a) - priority(b) || b.x - a.x)) {
      const width = Math.max(this.short(m.point.value).length, this.month(m.point.date).length) * 7 + 4;
      const anchor = m.x < left + 30 ? 'start' : m.x > w - right - 30 ? 'end' : 'middle';
      const x1 = anchor === 'start' ? m.x : anchor === 'end' ? m.x - width : m.x - width / 2;
      const box = (above: boolean): Box =>
        above
          ? { x1, x2: x1 + width, y1: m.y - 34, y2: m.y - 5 }
          : { x1, x2: x1 + width, y1: m.y + 10, y2: m.y + 39 };
      // Every dot also blocks its own spot, so a label never covers another sale.
      const dots = marks.filter((o) => o !== m).map((o) => ({ x1: o.x - 5, x2: o.x + 5, y1: o.y - 5, y2: o.y + 5 }));
      const free = (b: Box) => !overlaps(b) && !dots.some((d) => b.x1 < d.x2 && b.x2 > d.x1 && b.y1 < d.y2 && b.y2 > d.y1);
      const fitsAbove = m.y - 34 > 0;
      const fitsBelow = m.y + 40 <= base;
      const above = fitsAbove && free(box(true)) ? true : fitsBelow && free(box(false)) ? false : null;
      if (above === null) continue;
      m.label = { above, anchor };
      placed.push(box(above));
    }
    const path = (ps: { x: number; y: number }[]) =>
      ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    const lineMarks = line.map((p) => ({ x: x(+p.date), y: y(p.value), point: p }));
    // Recorded values joined in date order, and the last one joined (dashed) to the first model
    // value at or after it: the line the sales chart drew before the redesign.
    const recordedXY = points.map((p) => ({ x: x(+p.date), y: y(p.value) }));
    const lastRecorded = points.at(-1);
    const modelStart = lastRecorded
      ? [...line, ...(estimate ? [estimate] : [])]
          .filter((p) => +p.date >= +lastRecorded.date)
          .sort((a, b) => +a.date - +b.date)[0]
      : undefined;
    // The forecast starts from the estimate, whose own range is a different thing: it pinches the fan.
    const anchored: ChartForecastPoint[] = [
      ...(estimate && forecast.length
        ? [{ date: estimate.date, value: estimate.value, low: estimate.value, high: estimate.value }]
        : []),
      ...forecast,
    ];
    const fan: string[] = [];
    for (let i = 1; i < anchored.length; i++) {
      const a = anchored[i - 1],
        b = anchored[i];
      if (a.low === null || a.high === null || b.low === null || b.high === null) continue;
      fan.push(
        path([
          { x: x(+a.date), y: y(a.low) },
          { x: x(+b.date), y: y(b.low) },
          { x: x(+b.date), y: y(b.high) },
          { x: x(+a.date), y: y(a.high) },
        ]) + 'Z',
      );
    }
    const cross = this.lineHover();
    return {
      w,
      h,
      left,
      right,
      top,
      base,
      yTicks: yTickValues.map((v, i) => ({ v, y: y(v), label: yLabels[i] })),
      xTicks: timeTicks(from, to, w - left - right).map((t) => ({ x: x(+t.date), label: t.label })),
      today: +today >= +from && +today <= +to ? x(+today) : null,
      gaps: this.gaps().map((g) => ({ x: x(+g.from), w: Math.max(2, x(+g.to) - x(+g.from)) })),
      band:
        band.length > 1
          ? path(band.map((b) => ({ x: x(+b.date), y: y(b.high) }))) +
            path([...band].reverse().map((b) => ({ x: x(+b.date), y: y(b.low) }))).replace('M', 'L') +
            'Z'
          : null,
      line: lineMarks.length > 1 ? path(lineMarks) : null,
      recordedLine: this.connect() && recordedXY.length > 1 ? path(recordedXY) : null,
      bridge:
        this.connect() && lastRecorded && modelStart
          ? path([recordedXY.at(-1)!, { x: x(+modelStart.date), y: y(modelStart.value) }])
          : null,
      fan,
      forecastLine:
        anchored.length > 1 ? path(anchored.map((p) => ({ x: x(+p.date), y: y(p.value) }))) : null,
      lineMarks,
      cross: cross !== null && lineMarks[cross] ? lineMarks[cross].x : null,
      marks,
    };
  });

  readonly tip = computed(() => {
    const c = this.chart();
    const i = this.hover();
    const lineIndex = this.lineHover();
    const m = i !== null ? c.marks[i] : null;
    const target = m ?? (lineIndex !== null ? { ...c.lineMarks[lineIndex], kind: 'model' as const } : null);
    if (!target?.point) return null;
    return {
      x: Math.min(Math.max(target.x, 70), c.w - 70),
      y: target.y,
      below: target.y < 80,
      kind: this.kindLabel(target.kind),
      value: MONEY.format(target.point.value),
      date: DATE.format(target.point.date),
    };
  });

  track(event: PointerEvent) {
    const marks = this.chart().lineMarks;
    if (!marks.length) return;
    const rect = (event.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let best = 0;
    marks.forEach((m, i) => {
      if (Math.abs(m.x - px) < Math.abs(marks[best].x - px)) best = i;
    });
    this.hover.set(null);
    this.lineHover.set(best);
  }
  leave() {
    this.hover.set(null);
    this.lineHover.set(null);
  }
  short(v: number) {
    return axisMoney(v);
  }
  month(d: Date) {
    return monthLabel(d);
  }
  describe(m: Mark) {
    return `${this.kindLabel(m.kind)}, ${MONEY.format(m.point.value)}, ${DATE.format(m.point.date)}`;
  }
  private kindLabel(kind: MarkKind) {
    return kind === 'model'
      ? this.modelLabel()
      : kind === 'forecast'
        ? this.forecastLabel()
        : this.recordedLabel();
  }
}
