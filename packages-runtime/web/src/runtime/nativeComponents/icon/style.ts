export const ICON_SHADOW_STYLE = `
  :host {
    width: var(--weapp-icon-size);
    height: var(--weapp-icon-size);
    color: var(--weapp-icon-color);
    line-height: 1;
  }

  .icon {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    color: inherit;
  }

  .icon::before,
  .icon::after {
    position: absolute;
    box-sizing: border-box;
    content: '';
  }

  .success,
  .info,
  .warn,
  .cancel,
  .clear {
    background: currentColor;
    border-radius: 50%;
  }

  .success::before,
  .success_no_circle::before {
    top: 24%;
    left: 27%;
    width: 47%;
    height: 29%;
    border-bottom: max(1px, calc(var(--weapp-icon-size) * 0.09)) solid currentColor;
    border-left: max(1px, calc(var(--weapp-icon-size) * 0.09)) solid currentColor;
    transform: rotate(-45deg);
  }

  .success::before {
    color: #fff;
  }

  .info::before {
    top: 20%;
    left: 46%;
    width: 8%;
    height: 13%;
    background: #fff;
    border-radius: 50%;
  }

  .info::after {
    top: 39%;
    left: 46%;
    width: 8%;
    height: 40%;
    background: #fff;
    border-radius: 999px;
  }

  .warn::before {
    top: 18%;
    left: 46%;
    width: 8%;
    height: 43%;
    background: #fff;
    border-radius: 999px;
  }

  .warn::after {
    bottom: 19%;
    left: 46%;
    width: 8%;
    height: 8%;
    background: #fff;
    border-radius: 50%;
  }

  .waiting {
    border: max(1px, calc(var(--weapp-icon-size) * 0.08)) solid currentColor;
    border-radius: 50%;
  }

  .waiting::before {
    top: 20%;
    left: 46%;
    width: max(1px, calc(var(--weapp-icon-size) * 0.07));
    height: 33%;
    background: currentColor;
    border-radius: 999px;
    transform-origin: 50% 90%;
  }

  .waiting::after {
    top: 47%;
    left: 48%;
    width: 29%;
    height: max(1px, calc(var(--weapp-icon-size) * 0.07));
    background: currentColor;
    border-radius: 999px;
    transform: rotate(28deg);
    transform-origin: 0 50%;
  }

  .cancel::before,
  .cancel::after,
  .clear::before,
  .clear::after {
    top: 46%;
    left: 24%;
    width: 52%;
    height: max(1px, calc(var(--weapp-icon-size) * 0.08));
    background: #fff;
    border-radius: 999px;
  }

  .cancel::before,
  .clear::before {
    transform: rotate(45deg);
  }

  .cancel::after,
  .clear::after {
    transform: rotate(-45deg);
  }

  .download::before {
    top: 7%;
    left: 46%;
    width: 8%;
    height: 59%;
    background: currentColor;
    border-radius: 999px;
  }

  .download::after {
    top: 38%;
    left: 27%;
    width: 46%;
    height: 46%;
    border-right: max(1px, calc(var(--weapp-icon-size) * 0.08)) solid currentColor;
    border-bottom: max(1px, calc(var(--weapp-icon-size) * 0.08)) solid currentColor;
    transform: rotate(45deg);
  }

  .search::before {
    top: 8%;
    left: 8%;
    width: 64%;
    height: 64%;
    border: max(1px, calc(var(--weapp-icon-size) * 0.08)) solid currentColor;
    border-radius: 50%;
  }

  .search::after {
    right: 5%;
    bottom: 10%;
    width: 37%;
    height: max(1px, calc(var(--weapp-icon-size) * 0.08));
    background: currentColor;
    border-radius: 999px;
    transform: rotate(45deg);
    transform-origin: 100% 50%;
  }
`
