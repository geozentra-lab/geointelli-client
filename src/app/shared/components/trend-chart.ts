import { Component, input } from '@angular/core';
@Component({
  selector: 'gz-trend-chart',
  template: `<svg
    class="chart"
    viewBox="0 0 650 220"
    role="img"
    [attr.aria-label]="
      forecast() ? 'Illustrative value scenario' : 'Illustrative market value trend'
    "
  >
    <path class="gridline" d="M40 25h590M40 75h590M40 125h590M40 175h590" />
    <path
      class="area"
      d="M40 160 90 152 145 157 200 130 255 139 310 108 365 117 420 86 475 92 530 62 580 49 630 36V175H40Z"
    />
    <path
      class="line"
      d="M40 160 90 152 145 157 200 130 255 139 310 108 365 117 420 86 475 92 530 62 580 49 630 36"
    />
    @if (forecast()) {
      <path d="M420 86 630 13 630 113Z" fill="#f3e6d9" opacity=".85" />
      <path class="forecastline" d="M420 86 475 72 530 58 580 42 630 30" />
    }
    <text x="40" y="205">2021</text>
    <text x="155" y="205">2022</text>
    <text x="270" y="205">2023</text>
    <text x="385" y="205">2024</text>
    <text x="505" y="205">2025</text>
    <text x="603" y="205">{{ forecast() ? '2029' : '2026' }}</text>
  </svg>`,
})
export class TrendChart {
  forecast = input(false);
}
