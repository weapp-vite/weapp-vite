import { injectStyle } from '../style'

const BUTTON_STYLE_ID = 'weapp-web-button-style'
const styleTargets = new WeakSet<ParentNode>()
let sharedSheet: CSSStyleSheet | undefined

const BUTTON_STYLE = `
weapp-button {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

weapp-button.weapp-btn--mini {
  display: inline-block;
  width: auto;
}

weapp-button .weapp-btn {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 100%;
  border-radius: 5px;
  border: 1px solid #d9d9d9;
  padding: 0 16px;
  height: 44px;
  line-height: 44px;
  font-size: 17px;
  font-weight: 400;
  background-color: #f8f8f8;
  color: #000000;
  cursor: pointer;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

weapp-button.weapp-btn--primary .weapp-btn {
  background-color: #07c160;
  border-color: #07c160;
  color: #ffffff;
}

weapp-button.weapp-btn--warn .weapp-btn {
  background-color: #e64340;
  border-color: #e64340;
  color: #ffffff;
}

weapp-button.weapp-btn--plain .weapp-btn {
  background-color: transparent;
}

weapp-button.weapp-btn--plain.weapp-btn--default .weapp-btn {
  border-color: #b2b2b2;
  color: #353535;
}

weapp-button.weapp-btn--plain.weapp-btn--primary .weapp-btn {
  border-color: #07c160;
  color: #07c160;
}

weapp-button.weapp-btn--plain.weapp-btn--warn .weapp-btn {
  border-color: #e64340;
  color: #e64340;
}

weapp-button.weapp-btn--loading .weapp-btn,
weapp-button.weapp-btn--disabled .weapp-btn {
  background-color: #f7f7f7;
  border-color: #d9d9d9;
  color: #9b9b9b;
  cursor: not-allowed;
}

weapp-button.button-hover .weapp-btn {
  background-color: #ededed;
  border-color: #d2d2d2;
}

weapp-button.button-hover.weapp-btn--primary .weapp-btn {
  background-color: #06ad56;
  border-color: #06ad56;
}

weapp-button.button-hover.weapp-btn--warn .weapp-btn {
  background-color: #d93c37;
  border-color: #d93c37;
}

weapp-button.button-hover.weapp-btn--plain .weapp-btn {
  background-color: rgba(0, 0, 0, 0.06);
}

weapp-button.weapp-btn--mini .weapp-btn {
  height: 32px;
  line-height: 32px;
  font-size: 13px;
  padding: 0 12px;
  border-radius: 4px;
}

weapp-button .weapp-btn__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
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
