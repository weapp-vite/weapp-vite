export const PROGRESS_SHADOW_STYLE = `
  :host {
    min-width: 0;
  }

  .track {
    position: relative;
    min-width: 0;
    height: var(--weapp-progress-stroke-width);
    overflow: hidden;
    flex: 1;
    background: var(--weapp-progress-background-color);
    border-radius: var(--weapp-progress-border-radius);
  }

  .value {
    width: var(--weapp-progress-percent);
    height: 100%;
    background: var(--weapp-progress-active-color);
    border-radius: inherit;
    transition-property: width;
    transition-duration: var(--weapp-progress-duration);
    transition-timing-function: linear;
  }

  .info {
    min-width: 2.5em;
    margin-left: 5px;
    color: #888;
    font-size: var(--weapp-progress-font-size);
    line-height: 1;
    text-align: left;
    white-space: nowrap;
  }
`
