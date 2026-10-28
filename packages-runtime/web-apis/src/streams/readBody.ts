const typedArrayName = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag)?.get

/** 以内部类型标签识别跨 realm 字节视图，并复制到当前 realm 独占的 ArrayBuffer。 */
export function copyBodyChunk(value: unknown): Uint8Array<ArrayBuffer> {
  const tag = typedArrayName ? typedArrayName.call(value) : Object.prototype.toString.call(value).slice(8, -1)
  if (!ArrayBuffer.isView(value) || tag !== 'Uint8Array') {
    throw new TypeError('Body stream chunks must be Uint8Array values')
  }
  const copy = new Uint8Array(value.byteLength)
  copy.set(value as Uint8Array<ArrayBufferLike>)
  return copy
}

export async function readBodyStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>, signal?: AbortSignal | null): Promise<ArrayBuffer> {
  const reason = () => signal && signal.reason !== undefined ? signal.reason : Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
  if (signal?.aborted) {
    throw reason()
  }
  const reader = stream.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let length = 0
  let aborted = false
  const onAbort = () => {
    if (!aborted) {
      aborted = true
      void reader.cancel(reason()).catch(() => {})
    }
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    if (signal?.aborted) {
      onAbort()
    }
    while (true) {
      if (aborted) {
        throw reason()
      }
      const chunk = await reader.read()
      if (aborted) {
        throw reason()
      }
      if (chunk.done) {
        break
      }
      const copy = copyBodyChunk(chunk.value)
      chunks.push(copy)
      length += copy.byteLength
    }
  }
  finally {
    signal?.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }
  const merged = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}
