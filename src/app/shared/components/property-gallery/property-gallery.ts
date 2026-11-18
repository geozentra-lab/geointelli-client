import { LoadingSpinner } from '../loading-spinner';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PropertyImage } from '../../../core/models/property-image';
import { Icon } from '../icon/icon';
@Component({
  selector: 'gz-property-gallery',
  imports: [LoadingSpinner, Icon, DatePipe],
  templateUrl: './property-gallery.html',
  styleUrl: './property-gallery.css',
})
export class PropertyGallery {
  images = input.required<PropertyImage[]>();
  loading = input(false);
  error = input<string | null>(null);
  address = input('Property');
  retry = output<void>();
  selected = signal(0);
  loaded = signal<Set<string>>(new Set());
  failed = signal<Set<number>>(new Set());
  ordered = computed(() =>
    [...this.images()].sort(
      (a, b) =>
        Number(!!b.primaryImage) - Number(!!a.primaryImage) ||
        (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.id - b.id,
    ),
  );
  active = computed(() => this.ordered()[this.selected()] ?? null);
  constructor() {
    effect(() => {
      this.images();
      this.selected.set(0);
      this.failed.set(new Set());
      const urls = new Set(this.images().map((image) => image.storagePath));
      this.loaded.update((previous) => new Set([...previous].filter((url) => urls.has(url))));
    });
  }
  move(delta: number) {
    const n = this.ordered().length;
    if (n) this.selected.update((i) => (i + delta + n) % n);
  }
  markLoaded(url: string) {
    this.loaded.update((ids) => new Set([...ids, url]));
  }
  markFailed(id: number) {
    this.failed.update((ids) => new Set([...ids, id]));
  }
  keyboard(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
}
