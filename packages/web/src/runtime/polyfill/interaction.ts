export function resolveScanCodeResult(prompt?: (message: string, defaultValue: string) => unknown) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  let rawResult: unknown = runtimeGlobal.__weappViteWebScanCodeResult
  if (rawResult == null && typeof prompt === 'function') {
    rawResult = prompt('请输入二维码/条码内容', '')
  }
  if (rawResult == null) {
    return null
  }
  if (typeof rawResult === 'string') {
    return rawResult
  }
  return String((rawResult as { result?: unknown })?.result ?? '')
}

export async function writeClipboardData(data: string) {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  if (runtimeNavigator?.clipboard && typeof runtimeNavigator.clipboard.writeText === 'function') {
    await runtimeNavigator.clipboard.writeText(data)
    return
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard API is unavailable in current environment.')
  }

  const execCommand = (document as Document & { execCommand?: (command: string) => boolean }).execCommand
  if (typeof execCommand !== 'function') {
    throw new TypeError('Clipboard API is unavailable in current environment.')
  }

  const textarea = document.createElement('textarea') as HTMLTextAreaElement
  textarea.value = data
  textarea.setAttribute('readonly', 'true')
  textarea.setAttribute('style', 'position: fixed; top: -9999px; left: -9999px; opacity: 0;')
  document.body.append(textarea)
  textarea.select?.()
  const copied = execCommand.call(document, 'copy')
  if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea)
  }
  if (!copied) {
    throw new Error('document.execCommand("copy") returned false.')
  }
}

export async function readClipboardData() {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  if (!runtimeNavigator?.clipboard || typeof runtimeNavigator.clipboard.readText !== 'function') {
    throw new Error('Clipboard API is unavailable in current environment.')
  }
  return runtimeNavigator.clipboard.readText()
}
