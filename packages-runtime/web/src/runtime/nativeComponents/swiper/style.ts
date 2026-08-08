export const SWIPER_SHADOW_STYLE = `
  :host { position: relative; min-width: 0; min-height: 0; }
  .viewport { position: relative; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; touch-action: pan-y; }
  .track { display: flex; box-sizing: border-box; width: 100%; height: 100%; will-change: transform; }
  :host([data-vertical]) .viewport { touch-action: pan-x; }
  :host([data-vertical]) .track { flex-direction: column; }
  ::slotted(weapp-swiper-item) { flex: 0 0 calc(100% / var(--weapp-swiper-display-count, 1)); min-width: 0; min-height: 0; }
  :host(:not([data-vertical])) ::slotted(weapp-swiper-item) { height: 100%; }
  :host([data-vertical]) ::slotted(weapp-swiper-item) { width: 100%; }
  .indicators { position: absolute; right: 0; bottom: 10px; left: 0; display: flex; gap: 6px; justify-content: center; pointer-events: none; }
  :host([data-vertical]) .indicators { top: 0; right: 10px; bottom: 0; left: auto; flex-direction: column; }
  .indicators[hidden] { display: none; }
  .indicator { width: 8px; height: 8px; border-radius: 50%; background: var(--weapp-swiper-indicator-color, rgba(0, 0, 0, 0.3)); }
  .indicator[data-active="true"] { background: var(--weapp-swiper-indicator-active-color, #000000); }
`
