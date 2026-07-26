import { injectStyle } from '../style'

const BUTTON_STYLE_ID = 'weapp-web-button-style'
const styleTargets = new WeakSet<ParentNode>()
let sharedSheet: CSSStyleSheet | undefined

export const BUTTON_STYLE = `
weapp-button {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  display: block;
  width: 184px;
  max-width: 100%;
  min-width: 0;
  margin-right: auto;
  margin-left: auto;
  box-sizing: border-box;
  border: 1px solid #d9d9d9;
  border-radius: 5px;
  padding: 0 16px;
  line-height: calc(2.55555556em - 1px);
  font-size: 18px;
  font-weight: 400;
  background-color: #f8f8f8;
  color: #000000;
  cursor: pointer;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

weapp-button.weapp-btn--mini {
  display: inline-block;
  width: auto;
}

weapp-button .weapp-btn {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
  margin: 0;
  border: 0;
  border-radius: inherit;
  padding: 0;
  line-height: inherit;
  font: inherit;
  background: transparent;
  color: inherit;
  cursor: inherit;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

weapp-button.weapp-btn--primary {
  background-color: #07c160;
  border-color: #07c160;
  color: #ffffff;
}

weapp-button.weapp-btn--warn {
  background-color: #e64340;
  border-color: #e64340;
  color: #ffffff;
}

weapp-button.weapp-btn--plain {
  background-color: transparent;
}

weapp-button.weapp-btn--plain.weapp-btn--default {
  border-color: #a1a1a1;
  color: #353535;
}

weapp-button.weapp-btn--plain.weapp-btn--primary {
  border-color: #07c160;
  color: #07c160;
}

weapp-button.weapp-btn--plain.weapp-btn--warn {
  border-color: #e64340;
  color: #e64340;
}

weapp-button.weapp-btn--loading,
weapp-button.weapp-btn--disabled {
  background-color: #f7f7f7;
  border-color: #d9d9d9;
  color: #bbbbbb;
  cursor: not-allowed;
}

weapp-button.button-hover {
  background-color: #ededed;
  border-color: #d2d2d2;
}

weapp-button.button-hover.weapp-btn--primary {
  background-color: #06ad56;
  border-color: #06ad56;
}

weapp-button.button-hover.weapp-btn--warn {
  background-color: #d93c37;
  border-color: #d93c37;
}

weapp-button.button-hover.weapp-btn--plain {
  background-color: rgba(0, 0, 0, 0.06);
}

weapp-button.weapp-btn--mini {
  font-size: 13px;
}

weapp-button.weapp-btn--mini {
  height: 32px;
  line-height: 32px;
  padding: 0 12px;
  border-radius: 4px;
}

weapp-button .weapp-btn__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
}

weapp-button .weapp-btn__loading {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: weapp-btn-spin 0.8s linear infinite;
}

weapp-button .weapp-btn__loading[hidden] {
  display: none;
}

@keyframes weapp-btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function resolveAdoptedStyleSheets(root: ShadowRoot) {
  const doc = root.ownerDocument ?? document
  if (!doc || typeof doc.createElement !== 'function') {
    return undefined
  }
  if (!('adoptedStyleSheets' in doc)) {
    return undefined
  }
  if (!sharedSheet && 'replaceSync' in CSSStyleSheet.prototype) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(BUTTON_STYLE)
    sharedSheet = sheet
  }
  return sharedSheet
}

export function ensureButtonStyle(root?: ShadowRoot) {
  if (typeof document === 'undefined') {
    return
  }
  if (root && styleTargets.has(root)) {
    return
  }
  if (!root) {
    const target = document.head
    if (!target || styleTargets.has(target)) {
      return
    }
    injectStyle(BUTTON_STYLE, BUTTON_STYLE_ID)
    styleTargets.add(target)
    return
  }
  const sheet = resolveAdoptedStyleSheets(root)
  if (sheet) {
    const existing = root.adoptedStyleSheets ?? []
    if (!existing.includes(sheet)) {
      root.adoptedStyleSheets = [...existing, sheet]
    }
    styleTargets.add(root)
    return
  }
  const style = document.createElement('style')
  style.id = BUTTON_STYLE_ID
  style.textContent = BUTTON_STYLE
  root.appendChild(style)
  styleTargets.add(root)
}
