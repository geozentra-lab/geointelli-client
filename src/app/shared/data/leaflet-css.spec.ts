import { LEAFLET_CSS, loadLeafletCss } from './leaflet-css';

describe('Leaflet stylesheet', () => {
  afterEach(() => document.querySelectorAll('link[data-leaflet-css]').forEach((l) => l.remove()));

  it('is added once, first in the head, where the global styles used to carry it', () => {
    const first = document.createElement('style');
    document.head.appendChild(first);
    loadLeafletCss(document);
    loadLeafletCss(document);
    const links = document.querySelectorAll('link[data-leaflet-css]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(LEAFLET_CSS);
    expect(links[0].getAttribute('rel')).toBe('stylesheet');
    expect(document.head.firstElementChild).toBe(links[0]);
    first.remove();
  });
});
