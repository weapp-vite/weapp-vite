export function onDocumentReady(callback: () => void) {
  if (typeof document === 'undefined') {
    return
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true })
    return
  }
  callback()
}

export function getAppContainer() {
  if (typeof document === 'undefined') {
    return undefined
  }
  return document.querySelector('#app') as HTMLElement | null ?? undefined
}

export function ensureAppContainer() {
  const existing = getAppContainer()
  if (existing || typeof document === 'undefined' || !document.body) {
    return existing
  }
  const container = document.createElement('div')
  container.setAttribute('id', 'app')
  document.body.append(container)
  return container
}
