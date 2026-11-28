import {
  hasUsablePrototypeMethods,
  hasUsableResponseConstructor,
  hasUsableTextDecoderConstructor,
  hasUsableTextDecoderStreamConstructor,
  hasWebCompatibleUrlConstructor,
  patchHeadersConstructor,
  patchResponseConstructor,
  patchUrlConstructor,
  patchUrlSearchParamsConstructor,
} from './globalPatch'
import { shouldInstallWebRuntimeGlobal } from './globalValue'

export function ensureWebRuntimeHeaders(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)
    || !hasUsablePrototypeMethods(current, ['append', 'delete', 'entries', 'forEach', 'get', 'has', 'keys', 'set', 'values'])) {
    return fallback
  }
  return patchHeadersConstructor(current) ? current : fallback
}

export function ensureWebRuntimeResponse(
  current: unknown,
  fallback: unknown,
  responseFallback: { json?: unknown, error?: unknown } = fallback as { json?: unknown, error?: unknown },
) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  if (!hasUsableResponseConstructor(current)) {
    return fallback
  }
  return patchResponseConstructor(current, responseFallback) ? current : fallback
}

export function ensureWebRuntimeURL(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  return hasWebCompatibleUrlConstructor(current) && patchUrlConstructor(current) ? current : fallback
}

export function ensureWebRuntimeURLSearchParams(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  return patchUrlSearchParamsConstructor(current) ? current : fallback
}

export function ensureWebRuntimeBlob(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  return hasUsablePrototypeMethods(current, ['arrayBuffer', 'slice']) ? current : fallback
}

export function ensureWebRuntimeFile(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  return hasUsablePrototypeMethods(current, ['arrayBuffer', 'slice'], ['name']) ? current : fallback
}

export function ensureWebRuntimeFormData(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current)) {
    return fallback
  }
  return hasUsablePrototypeMethods(current, ['append', 'entries']) ? current : fallback
}

export function ensureWebRuntimeTextDecoder(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current) || !hasUsableTextDecoderConstructor(current)) {
    return fallback
  }
  return current
}

export function ensureWebRuntimeTextDecoderStream(current: unknown, fallback: unknown, usesNativeStreams = true) {
  if (shouldInstallWebRuntimeGlobal(current) || !usesNativeStreams) {
    return fallback
  }
  return hasUsableTextDecoderStreamConstructor(current) ? current : fallback
}
