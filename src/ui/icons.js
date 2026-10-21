// Inline SVG icons (no icon font, no CDN). 24-unit viewBox, 1.8 stroke, currentColor.
import { svg } from 'lit';

const wrap = (body, extra = '') => svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${extra}>${body}</svg>`;

export const I = {
  search: () => wrap(svg`<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`),
  x: () => wrap(svg`<path d="M6 6l12 12M18 6 6 18"/>`),
  basket: () => wrap(svg`<path d="M3 10h18l-1.6 9a2 2 0 0 1-2 1.7H6.6a2 2 0 0 1-2-1.7L3 10Z"/><path d="m8 10 3-6M16 10l-3-6"/>`),
  cog: () => wrap(svg`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>`),
  play: () => wrap(svg`<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>`),
  pause: () => wrap(svg`<rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/>`),
  plus: () => wrap(svg`<path d="M12 5v14M5 12h14"/>`),
  minus: () => wrap(svg`<path d="M5 12h14"/>`),
  trash: () => wrap(svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`),
  check: () => wrap(svg`<path d="m5 12 4 4L19 6"/>`),
  chevronL: () => wrap(svg`<path d="m15 5-7 7 7 7"/>`),
  chevronR: () => wrap(svg`<path d="m9 5 7 7-7 7"/>`),
  link: () => wrap(svg`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`),
  download: () => wrap(svg`<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>`),
  upload: () => wrap(svg`<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>`),
  pin: () => wrap(svg`<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>`),
  info: () => wrap(svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`),
  center: () => wrap(svg`<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>`),
  tag: () => wrap(svg`<path d="M20 12 12 20l-8-8V4h8l8 8Z"/><circle cx="8.5" cy="8.5" r="1.3"/>`),
  store: () => wrap(svg`<path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>`),
  clock: () => wrap(svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  layers: () => wrap(svg`<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>`),
};
