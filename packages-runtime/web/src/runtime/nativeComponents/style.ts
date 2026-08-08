import { NATIVE_COMPONENT_DESCRIPTORS } from '../../shared/nativeComponents'
import { injectStyle } from '../style'

const NATIVE_COMPONENT_STYLE_ID = 'weapp-web-native-component-style'
const styleTargets = new WeakSet<ParentNode>()
let sharedSheet: CSSStyleSheet | undefined

export const NATIVE_COMPONENT_STYLE = NATIVE_COMPONENT_DESCRIPTORS
  .map(descriptor => `${descriptor.webTag} { ${descriptor.defaultStyle} }`)
  .join('\n')

function resolveSharedStyleSheet(root: ShadowRoot) {
  const ownerDocument = root.ownerDocument ?? document
  if (!('adoptedStyleSheets' in ownerDocument) || !('replaceSync' in CSSStyleSheet.prototype)) {
    return undefined
  }
  if (!sharedSheet) {
    sharedSheet = new CSSStyleSheet()
    sharedSheet.replaceSync(NATIVE_COMPONENT_STYLE)
  }
  return sharedSheet
}

export function ensureNativeComponentStyle(root?: ShadowRoot) {
  if (typeof document === 'undefined') {
    return
  }
  const target = root ?? document.head
  if (!target || styleTargets.has(target)) {
    return
  }
  if (!root) {
    injectStyle(NATIVE_COMPONENT_STYLE, NATIVE_COMPONENT_STYLE_ID)
    styleTargets.add(target)
    return
  }
  const sheet = resolveSharedStyleSheet(root)
  if (sheet) {
    const existing = root.adoptedStyleSheets ?? []
    if (!existing.includes(sheet)) {
      root.adoptedStyleSheets = [...existing, sheet]
    }
  }
  else {
    const style = document.createElement('style')
    style.id = NATIVE_COMPONENT_STYLE_ID
    style.textContent = NATIVE_COMPONENT_STYLE
    root.append(style)
  }
  styleTargets.add(target)
}
