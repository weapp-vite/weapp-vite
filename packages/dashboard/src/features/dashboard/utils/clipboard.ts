function copyTextWithFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy text failed')
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
    copyTextWithFallback(text)
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
