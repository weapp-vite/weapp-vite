export const NAVBAR_STYLE = `
:host {
  --weapp-status-bar-height: 20px;
  --weapp-nav-content-height: 44px;
  --weapp-nav-height: calc(var(--weapp-status-bar-height) + var(--weapp-nav-content-height));
  --weapp-nav-bg: #ffffff;
  --weapp-nav-color: #000000;
  --weapp-nav-transition-duration: 0ms;
  --weapp-nav-transition-easing: ease;
  display: block;
  position: relative;
  z-index: 999;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
}

.weapp-nav__spacer {
  height: var(--weapp-nav-height);
}

.weapp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--weapp-nav-height);
  display: flex;
  flex-direction: column;
  background: var(--weapp-nav-bg);
  color: var(--weapp-nav-color);
  box-shadow: 0 0.5px 0 rgba(0, 0, 0, 0.1);
  transition:
    background-color var(--weapp-nav-transition-duration) var(--weapp-nav-transition-easing),
    color var(--weapp-nav-transition-duration) var(--weapp-nav-transition-easing);
}

.weapp-nav--transparent {
  box-shadow: none;
}

.weapp-nav__status {
  height: var(--weapp-status-bar-height);
}

.weapp-nav__content {
  height: var(--weapp-nav-content-height);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 17px;
  font-weight: 500;
  line-height: 1;
}

.weapp-nav__left,
.weapp-nav__right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 88px;
  display: flex;
  align-items: center;
}

.weapp-nav__left {
  left: 12px;
}

.weapp-nav__right {
  right: 12px;
  justify-content: flex-end;
}

.weapp-nav__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weapp-nav__loading {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: weapp-nav-spin 0.8s linear infinite;
}

.weapp-nav__loading[hidden] {
  display: none;
}

@keyframes weapp-nav-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`
