export const PICKER_VIEW_SHADOW_STYLE = `
  :host { position: relative; min-width: 0; }
  .viewport { position: relative; display: flex; width: 100%; height: 100%; overflow: hidden; }
  slot { display: flex; width: 100%; height: 100%; }
  ::slotted(weapp-picker-view-column) { min-width: 0; flex: 1; }
  .mask,
  .indicator { position: absolute; right: 0; left: 0; pointer-events: none; }
  .mask--top {
    top: 0;
    bottom: 50%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.35));
  }
  .mask--bottom {
    top: 50%;
    bottom: 0;
    background: linear-gradient(to top, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.35));
  }
  .indicator {
    top: 50%;
    box-sizing: border-box;
    height: var(--weapp-picker-view-item-height, 34px);
    border-top: 1px solid #e5e5e5;
    border-bottom: 1px solid #e5e5e5;
    transform: translateY(-50%);
  }
`

export const PICKER_VIEW_COLUMN_SHADOW_STYLE = `
  :host { min-width: 0; overflow: hidden; }
  .scroller {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    scroll-snap-type: y mandatory;
    touch-action: pan-y;
  }
  .scroller::-webkit-scrollbar { display: none; }
  .spacer { width: 1px; height: calc((100% - var(--weapp-picker-view-item-height, 34px)) / 2); }
  slot { display: block; }
  ::slotted(*) {
    box-sizing: border-box;
    height: var(--weapp-picker-view-item-height, 34px);
    overflow: hidden;
    line-height: var(--weapp-picker-view-item-height, 34px);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    scroll-snap-align: center;
  }
`
