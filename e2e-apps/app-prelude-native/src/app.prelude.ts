const host = globalThis as typeof globalThis & {
  __appPreludeLog__?: string[]
}

const message = `app.prelude.ts:${import.meta.filename}`

// eslint-disable-next-line no-console
console.log(message)

host.__appPreludeLog__ = [
  ...(host.__appPreludeLog__ ?? []),
  message,
]
