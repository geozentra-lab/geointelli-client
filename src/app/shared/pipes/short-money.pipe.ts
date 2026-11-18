import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'shortMoney' })
export class ShortMoneyPipe implements PipeTransform {
  transform(value: number): string {
    return Math.abs(value) >= 1e6
      ? '$' + (value / 1e6).toFixed(2) + 'M'
      : '$' + Math.round(value / 1000) + 'K';
  }
}
