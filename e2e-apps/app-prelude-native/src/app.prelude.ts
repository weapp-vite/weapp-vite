const host = globalThis as typeof globalThis & {
  __appPreludeLog__?: string[]
}

host.__appPreludeLog__ = [
  ...(host.__appPreludeLog__ ?? []),
  `app.prelude.ts:${import.meta.filename}`,
]
