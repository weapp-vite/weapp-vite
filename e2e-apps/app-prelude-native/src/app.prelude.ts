const host = globalThis as typeof globalThis & {
  __appPreludeLog__?: string[]
  __appPreludeRuntimeState__?: {
    fetch: string
    url: string
    webRuntimeInstalled: boolean
  }
  __weappViteWebRuntimePreludeState__?: {
    installed?: boolean
  }
}

const message = `app.prelude.ts:${import.meta.filename}`
const webRuntimeState = host.__weappViteWebRuntimePreludeState__

host.__appPreludeRuntimeState__ = {
  fetch: typeof fetch,
  url: typeof URL,
  webRuntimeInstalled: webRuntimeState?.installed === true,
}

// eslint-disable-next-line no-console
console.log(message)

host.__appPreludeLog__ = [
  ...(host.__appPreludeLog__ ?? []),
  message,
]
