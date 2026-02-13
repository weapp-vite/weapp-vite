const TOAST_ID = '__weapp_vite_web_toast__'
const TOAST_SELECTOR = `#${TOAST_ID}`
const LOADING_ID = '__weapp_vite_web_loading__'
const LOADING_SELECTOR = `#${LOADING_ID}`

export function getGlobalDialogHandlers() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  return {
    confirm: runtimeGlobal.confirm as ((message?: string) => boolean) | undefined,
    alert: runtimeGlobal.alert as ((message?: string) => void) | undefined,
    prompt: runtimeGlobal.prompt as ((message?: string, defaultValue?: string) => string | null) | undefined,
  }
}

export function getToastElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(TOAST_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  const toast = document.createElement('div')
  toast.setAttribute('id', TOAST_ID)
  toast.setAttribute('data-weapp-web-toast', 'true')
  toast.setAttribute('hidden', 'true')
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  if (!document.body) {
    return undefined
  }
  document.body.append(toast)
  return toast
}

export function setToastVisible(toast: HTMLElement, visible: boolean) {
  if (visible) {
    toast.removeAttribute('hidden')
  }
  else {
    toast.setAttribute('hidden', 'true')
  }
  toast.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 15%',
    'transform: translate(-50%, 0)',
    'max-width: min(560px, 90vw)',
    'padding: 10px 14px',
    'border-radius: 8px',
    'background: rgba(17, 24, 39, 0.9)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    'pointer-events: none',
    'z-index: 2147483646',
    `opacity: ${visible ? '1' : '0'}`,
  ].join(';'))
}

export function hideToastElement() {
  const toast = getToastElement()
  if (!toast) {
    return
  }
  setToastVisible(toast, false)
}

export function resolveToastPrefix(icon: 'success' | 'error' | 'none' | undefined) {
  if (icon === 'none') {
    return ''
  }
  if (icon === 'error') {
    return '[error] '
  }
  return '[ok] '
}

export function getLoadingElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(LOADING_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  if (!document.body) {
    return undefined
  }
  const loading = document.createElement('div')
  loading.setAttribute('id', LOADING_ID)
  loading.setAttribute('data-weapp-web-loading', 'true')
  loading.setAttribute('hidden', 'true')
  loading.setAttribute('role', 'status')
  loading.setAttribute('aria-live', 'polite')
  document.body.append(loading)
  return loading
}

export function setLoadingVisible(
  loading: HTMLElement,
  visible: boolean,
  title: string,
  mask: boolean,
) {
  if (visible) {
    loading.removeAttribute('hidden')
  }
  else {
    loading.setAttribute('hidden', 'true')
  }
  loading.textContent = title
  loading.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 45%',
    'transform: translate(-50%, -50%)',
    'min-width: 120px',
    'max-width: min(560px, 90vw)',
    'padding: 14px 18px',
    'border-radius: 10px',
    'background: rgba(17, 24, 39, 0.92)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    `pointer-events: ${mask ? 'auto' : 'none'}`,
    'z-index: 2147483647',
    `opacity: ${visible ? '1' : '0'}`,
    `box-shadow: ${mask ? '0 0 0 99999px rgba(0, 0, 0, 0.28)' : 'none'}`,
  ].join(';'))
}

export function resolveActionSheetSelection(itemList: string[]) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebActionSheetSelectIndex
  if (typeof preset === 'function') {
    const result = preset(itemList)
    if (Number.isInteger(result) && result >= 0 && result < itemList.length) {
      return result
    }
  }
  if (Number.isInteger(preset) && (preset as number) >= 0 && (preset as number) < itemList.length) {
    return preset as number
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const lines = itemList.map((item, index) => `[${index}] ${item}`)
    const input = prompt(['请选择操作：', ...lines].join('\n'), '0')
    if (input === null) {
      return null
    }
    const parsed = Number.parseInt(String(input), 10)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < itemList.length) {
      return parsed
    }
  }
  return 0
}
