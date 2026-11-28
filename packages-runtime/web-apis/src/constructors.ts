import { resolveGlobalValue } from './globalValue'
import { URLPolyfill, URLSearchParamsPolyfill } from './url'

export function resolveUrlConstructor() {
  const HostUrl = resolveGlobalValue<typeof URL>('URL')
  return typeof HostUrl === 'function' ? HostUrl : undefined
}

export function isUrlInstance(value: unknown): value is URL | URLPolyfill {
  const HostUrl = resolveUrlConstructor()
  return Boolean(
    (HostUrl && value instanceof HostUrl)
    || value instanceof URLPolyfill,
  )
}

export function resolveUrlSearchParamsConstructor() {
  const HostUrlSearchParams = resolveGlobalValue<typeof URLSearchParams>('URLSearchParams')
  return typeof HostUrlSearchParams === 'function' ? HostUrlSearchParams : undefined
}

export function isUrlSearchParamsInstance(value: unknown): value is URLSearchParams | URLSearchParamsPolyfill {
  const HostUrlSearchParams = resolveUrlSearchParamsConstructor()
  return Boolean(
    (HostUrlSearchParams && value instanceof HostUrlSearchParams)
    || value instanceof URLSearchParamsPolyfill,
  )
}

export function resolveTextEncoderConstructor() {
  const TextEncoderConstructor = resolveGlobalValue<typeof TextEncoder>('TextEncoder')
  return typeof TextEncoderConstructor === 'function' ? TextEncoderConstructor : undefined
}

export function resolveTextDecoderConstructor() {
  const TextDecoderConstructor = resolveGlobalValue<typeof TextDecoder>('TextDecoder')
  return typeof TextDecoderConstructor === 'function' ? TextDecoderConstructor : undefined
}
