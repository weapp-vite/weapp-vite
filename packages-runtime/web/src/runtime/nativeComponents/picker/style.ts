export const PICKER_SHADOW_STYLE = `
  :host { position: relative; cursor: pointer; }
  :host([disabled]) { cursor: not-allowed; opacity: 0.6; }
  .backdrop {
    position: fixed;
    z-index: 1200;
    inset: 0;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.5);
  }
  .backdrop[hidden] { display: none; }
  .panel {
    box-sizing: border-box;
    width: 100%;
    max-height: min(72vh, 520px);
    padding-bottom: var(--weapp-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    color: #000000;
    background: #ffffff;
  }
  .toolbar {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 72px;
    align-items: center;
    min-height: 52px;
    border-bottom: 1px solid #e5e5e5;
  }
  .toolbar button {
    min-width: 0;
    height: 52px;
    padding: 0 16px;
    border: 0;
    color: #576b95;
    background: transparent;
    font: inherit;
  }
  .toolbar button:last-child { color: #07c160; }
  .title {
    overflow: hidden;
    font-size: 15px;
    font-weight: 500;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .editors {
    display: flex;
    box-sizing: border-box;
    gap: 8px;
    min-height: 216px;
    padding: 16px;
  }
  .editors select,
  .editors input {
    box-sizing: border-box;
    min-width: 0;
    flex: 1;
    border: 1px solid #d8d8d8;
    border-radius: 4px;
    color: inherit;
    background: #ffffff;
    font: inherit;
  }
  .editors select { padding: 6px; }
  .editors input { align-self: center; height: 44px; padding: 0 12px; }
`
