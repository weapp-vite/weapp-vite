export const SLIDER_SHADOW_STYLE = `
  :host { min-width: 0; }
  .slider {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 28px;
  }
  input {
    width: 100%;
    min-width: 0;
    height: 2px;
    margin: 0;
    flex: 1;
    padding: 0;
    border: 0;
    border-radius: 1px;
    outline: 0;
    appearance: none;
    background: linear-gradient(
      to right,
      var(--weapp-slider-active-color, #1aad19) 0%,
      var(--weapp-slider-active-color, #1aad19) var(--weapp-slider-progress, 0%),
      var(--weapp-slider-background-color, #e9e9e9) var(--weapp-slider-progress, 0%),
      var(--weapp-slider-background-color, #e9e9e9) 100%
    );
  }
  input::-webkit-slider-thumb {
    width: var(--weapp-slider-block-size, 28px);
    height: var(--weapp-slider-block-size, 28px);
    border: 0;
    border-radius: 50%;
    appearance: none;
    background: var(--weapp-slider-block-color, #ffffff);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  }
  input::-moz-range-thumb {
    width: var(--weapp-slider-block-size, 28px);
    height: var(--weapp-slider-block-size, 28px);
    border: 0;
    border-radius: 50%;
    background: var(--weapp-slider-block-color, #ffffff);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  }
  input:disabled { opacity: 0.5; cursor: not-allowed; }
  output {
    width: 3em;
    margin-left: 12px;
    color: #888888;
    font-size: 14px;
    line-height: 28px;
    text-align: right;
  }
  output[hidden] { display: none; }
`
