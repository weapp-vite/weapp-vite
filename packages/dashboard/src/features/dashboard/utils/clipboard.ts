/** 同步复制；不支持时由调用方提供手动复制，避免迟到的异步写入覆盖新文本。 */
export function copyTextSynchronously(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('copy text failed')
    }
  }
  finally {
    textarea.remove()
  }
}

async function writeClipboardText(text: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('clipboard write timeout'))
        }, 800)
      }),
    ])
  }
  finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function copyText(text: string) {
  try {
    copyTextSynchronously(text)
    return
  }
  catch {
    if (navigator.clipboard && window.isSecureContext) {
      await writeClipboardText(text)
      return
    }
  }

  throw new Error('copy text failed')
}
