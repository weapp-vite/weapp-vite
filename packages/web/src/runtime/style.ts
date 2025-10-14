const injected = new Map<string, HTMLStyleElement>()

function createStyleId(css: string) {
  let hash = 2166136261
  for (let i = 0; i < css.length; i++) {
    hash ^= css.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return `weapp-web-style-${(hash >>> 0).toString(36)}`
}

export function removeStyle(id: string) {
  if (typeof document === 'undefined') {
    return
  }
  const style = injected.get(id)
  if (style) {
    style.remove()
    injected.delete(id)
  }
}

export function injectStyle(css: string, id?: string) {
  if (typeof document === 'undefined') {
    return () => {}
  }
  const styleId = id ?? createStyleId(css)
  const existing = injected.get(styleId)
  if (existing) {
    existing.textContent = css
    return () => removeStyle(styleId)
  }
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = css
  document.head.append(style)
  injected.set(styleId, style)
  return () => removeStyle(styleId)
}
