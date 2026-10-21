/**
 * Vector icon set. One inline SVG sprite, referenced with <use>. Every icon is
 * drawn on a 24×24 grid with currentColor strokes, so colour and size come from
 * CSS. Icons are decorative: the control that holds one must carry an accessible
 * name (aria-label or visible text). No emoji or text glyphs are used as controls.
 */

export type IconName =
  | 'menu'
  | 'sliders'
  | 'mic'
  | 'stop'
  | 'send'
  | 'plus'
  | 'trash'
  | 'download'
  | 'close'
  | 'alert'
  | 'wifi-off'
  | 'logo';

const PATHS: Record<IconName, string> = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  sliders:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor" stroke="none"/>',
  send: '<path d="M3.5 11.2 20.5 4 14 20.5l-2.9-6.6L3.5 11.2Z"/><path d="M11.1 13.9 20.5 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
  'wifi-off':
    '<path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0M5.2 12.9a9.5 9.5 0 0 1 4.6-2.5M12 9.7c1.5 0 2.9.5 4 1.4M2 9a15 15 0 0 1 4-2.6M11 5.1A15 15 0 0 1 22 9"/>',
  logo:
    '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/>',
};

/** Hidden sprite, inserted once at the top of the app. */
export const ICON_SPRITE =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
  (Object.keys(PATHS) as IconName[])
    .map((name) => `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</symbol>`)
    .join('') +
  '</defs></svg>';

/** Markup for one icon. Decorative by design (aria-hidden). */
export function icon(name: IconName, cls = ''): string {
  const classes = cls ? `ico ${cls}` : 'ico';
  return `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
