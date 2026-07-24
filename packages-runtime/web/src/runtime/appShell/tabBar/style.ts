export const TAB_BAR_STYLE = `
:host {
  --weapp-tab-bar-color: #7a7e83;
  --weapp-tab-bar-selected-color: #3cc51f;
  --weapp-tab-bar-background: #ffffff;
  --weapp-tab-bar-border-color: rgba(0, 0, 0, 0.33);
  display: block;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  box-sizing: border-box;
  color: var(--weapp-tab-bar-color);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}

:host([position="top"]) {
  top: 0;
  bottom: auto;
}

:host([hidden]) {
  display: none;
}

.weapp-tab-bar {
  display: flex;
  height: calc(50px + var(--weapp-safe-area-inset-bottom, 0px));
  padding-bottom: var(--weapp-safe-area-inset-bottom, 0px);
  box-sizing: border-box;
  background: var(--weapp-tab-bar-background);
  border-top: 0.5px solid var(--weapp-tab-bar-border-color);
}

:host([position="top"]) .weapp-tab-bar {
  height: 50px;
  padding-bottom: 0;
  border-top: 0;
  border-bottom: 0.5px solid var(--weapp-tab-bar-border-color);
}

.weapp-tab-bar__item {
  position: relative;
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  height: 50px;
  padding: 5px 4px 3px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1px;
  border: 0;
  border-radius: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}

.weapp-tab-bar__item[aria-current="page"] {
  color: var(--weapp-tab-bar-selected-color);
}

.weapp-tab-bar__icon-wrap {
  position: relative;
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
}

.weapp-tab-bar__icon {
  display: block;
  width: 27px;
  height: 27px;
  object-fit: contain;
}

.weapp-tab-bar__label {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weapp-tab-bar__badge {
  position: absolute;
  top: -3px;
  left: 20px;
  min-width: 16px;
  max-width: 48px;
  height: 16px;
  padding: 0 4px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #ffffff;
  border-radius: 8px;
  background: #fa5151;
  color: #ffffff;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weapp-tab-bar__badge--dot {
  top: 0;
  left: 23px;
  width: 8px;
  min-width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
}
`
