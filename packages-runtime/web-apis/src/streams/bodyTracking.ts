import { usesNativeStreams } from '../streams'
import { isPonyfillStream, isPonyfillStreamDisturbed } from './ponyfillState'

const HostReadableStream = globalThis.ReadableStream
const HostResponse = globalThis.Response
const hostBodyUsed = typeof HostResponse === 'function' ? Object.getOwnPropertyDescriptor(HostResponse.prototype, 'bodyUsed')?.get : undefined
const nativeStates = new WeakMap<ReadableStream, () => boolean>()

/** 只观察已支持流族的内部状态；不修改调用者的流、reader 或其原型。 */
export function observeBodyStream<T>(stream: ReadableStream<T>) {
  if (isPonyfillStream(stream)) {
    isPonyfillStreamDisturbed(stream)
    return stream
  }
  if (nativeStates.has(stream)) {
    return stream
  }
  if (usesNativeStreams && stream instanceof HostReadableStream && hostBodyUsed) {
    try {
      const response = new HostResponse(stream)
      if (response.body === stream) {
        nativeStates.set(stream, () => hostBodyUsed.call(response))
        return stream
      }
    }
    catch {
      nativeStates.set(stream, () => true)
      return stream
    }
  }
  throw new TypeError('Body stream must use the supported native or ponyfill ReadableStream constructor')
}

export function isBodyStreamDisturbed(stream: ReadableStream) {
  if (isPonyfillStream(stream)) {
    return isPonyfillStreamDisturbed(stream)
  }
  return nativeStates.get(stream)?.() === true
}
