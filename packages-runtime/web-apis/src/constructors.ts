import { URLPolyfill, URLSearchParamsPolyfill } from './url'

export function resolveUrlConstructor() {
  return typeof globalThis.URL === 'function'
    ? globalThis.URL
    : undefined
}

export function isUrlInstance(value: unknown): value is URL | URLPolyfill {
  const HostUrl = resolveUrlConstructor()
  return Boolean(
    (HostUrl && value instanceof HostUrl)
    || value instanceof URLPolyfill,
  )
}

export function resolveUrlSearchParamsConstructor() {
  return typeof globalThis.URLSearchParams === 'function'
    ? globalThis.URLSearchParams
    : undefined
}

export function isUrlSearchParamsInstance(value: unknown): value is URLSearchParams | URLSearchParamsPolyfill {
  const HostUrlSearchParams = resolveUrlSearchParamsConstructor()
  return Boolean(
    (HostUrlSearchParams && value instanceof HostUrlSearchParams)
    || value instanceof URLSearchParamsPolyfill,
  )
}

export function resolveTextEncoderConstructor() {
  return typeof globalThis.TextEncoder === 'function'
    ? globalThis.TextEncoder
    : undefined
}

export function resolveTextDecoderConstructor() {
  return typeof globalThis.TextDecoder === 'function'
    ? globalThis.TextDecoder
    : undefined
}
