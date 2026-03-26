export const DEVICE_TOOLBAR_STORAGE_KEY = 'mpcore-web-demo-device-toolbar'
export const DEFAULT_STAGE_HEIGHT = 760
export const DEFAULT_ZOOM_PERCENT = 100
export const DEVICE_PRESETS = [
  { label: 'iPhone 14 Pro', value: 'iphone-14-pro', width: 393, height: 852 },
  { label: 'Pixel 7', value: 'pixel-7', width: 412, height: 915 },
  { label: 'iPad Mini', value: 'ipad-mini', width: 768, height: 1024 },
  { label: 'WeChat 基准', value: 'wechat-base', width: 375, height: 812 },
] as const

export type DevicePresetValue = typeof DEVICE_PRESETS[number]['value'] | 'custom'
export type ZoomMode = 'fit' | 'custom'

export interface PreviewTapEvent {
  currentTarget: { dataset: Record<string, string>, id: string }
  target: { dataset: Record<string, string>, id: string }
}

export interface PreviewTapInvocation {
  event: PreviewTapEvent
  method: string
  scopeId: string
  stopAfter: boolean
}

export const PREVIEW_SHADOW_CSS = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sim-shadow-screen {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 100%;
    overflow: auto;
    padding: 12px;
    background:
      linear-gradient(180deg, rgb(255 255 255 / 72%), rgb(242 247 252 / 98%));
  }

  .sim-shadow-screen page,
  .sim-shadow-screen view,
  .sim-shadow-screen text,
  .sim-shadow-screen button {
    display: block;
  }

  .sim-shadow-screen page {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 16px 14px 18px;
    margin: 0;
    color: var(--sim-preview-page-text, #18344f);
    background: linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
    border-radius: 28px;
    box-shadow: 0 10px 28px var(--sim-preview-page-shadow, rgb(15 27 40 / 10%));
  }

  .sim-shadow-screen view {
    padding: 10px 12px;
    margin-bottom: 8px;
    background: var(--sim-preview-block-bg, rgb(14 98 207 / 5%));
    border: 1px solid var(--sim-preview-block-border, rgb(14 98 207 / 8%));
    border-radius: 12px;
  }

  .sim-shadow-screen [bindtap],
  .sim-shadow-screen [bind\\:tap],
  .sim-shadow-screen [catchtap],
  .sim-shadow-screen [catch\\:tap] {
    cursor: pointer;
    box-shadow: inset 0 0 0 1px var(--sim-preview-tap-ring, rgb(135 243 216 / 18%));
  }

  .sim-shadow-screen [bindtap]:active,
  .sim-shadow-screen [bind\\:tap]:active,
  .sim-shadow-screen [catchtap]:active,
  .sim-shadow-screen [catch\\:tap]:active {
    background: var(--sim-preview-active-bg, rgb(135 243 216 / 18%));
    transform: scale(0.99);
  }

  .sim-shadow-screen .screen {
    background: linear-gradient(180deg, #f6f8fc 0%, #ffffff 100%);
    border: none;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }

  .sim-shadow-screen .status {
    margin: 16px 14px 10px;
    padding: 20px 16px 12px;
    color: #f7fbff;
    background: linear-gradient(180deg, #1a2d52 0%, #111f39 100%);
    border: none;
    border-radius: 16px;
    font-weight: 700;
    text-align: center;
  }

  .sim-shadow-screen .hero {
    margin: 0 14px 14px;
    padding: 14px 14px 16px;
    color: #f2f6ff;
    background: linear-gradient(180deg, #1f3258 0%, #263d66 100%);
    border: 1px solid rgb(45 67 107 / 70%);
    border-radius: 18px;
  }

  .sim-shadow-screen .hero-title,
  .sim-shadow-screen .hero-subtitle {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  .sim-shadow-screen .hero-title {
    margin-bottom: 6px;
    font-size: 18px;
    font-weight: 800;
  }

  .sim-shadow-screen .hero-subtitle {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 700;
    opacity: 0.92;
  }

  .sim-shadow-screen .hero-copy {
    padding: 0;
    margin-bottom: 12px;
    color: rgb(228 236 252 / 90%);
    background: transparent;
    border: none;
    font-size: 12px;
    line-height: 1.7;
  }

  .sim-shadow-screen .hero-actions {
    display: flex;
    gap: 10px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
  }

  .sim-shadow-screen .hero-actions view {
    flex: 1;
    margin: 0;
    padding: 8px 10px;
    color: #1d3260;
    background: #ffffff;
    border: none;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
  }

  .sim-shadow-screen .section-title {
    margin: 0 12px 8px;
    padding: 0 4px;
    color: #313949;
    background: transparent;
    border: none;
    font-size: 13px;
    font-weight: 800;
  }

  .sim-shadow-screen .metric-card,
  .sim-shadow-screen .entry-card {
    margin: 0 12px 10px;
    padding: 14px 14px;
    color: #1d2b43;
    background: #ffffff;
    border: 1px solid rgb(216 226 239 / 95%);
    border-radius: 16px;
    box-shadow: 0 8px 20px rgb(19 42 72 / 5%);
    font-weight: 700;
  }
`
