import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import { refreshVueFileJsonConfig } from 'wevu/compiler'
import { normalizeVueTransformResult } from '../shared'

function isVueJsonOnlyDirtyReasonSummary(dirtyReasonSummary: string[] | undefined) {
  return Boolean(
    dirtyReasonSummary?.length
    && dirtyReasonSummary.every(item => item.startsWith('entry-json-only:')),
  )
}

export async function tryRefreshJsonOnlyVueCompilation(options: {
  cachedResult: VueTransformResult | undefined
  compileOptions: CompileVueFileOptions
  dirtyEntryId: string | undefined
  dirtyReasonSummary: string[] | undefined
  filename: string
  isDev: boolean
  scanDirty: boolean
  source: string
  autoRoutesSignature?: string
  cachedAutoRoutesSignature?: string
}) {
  const {
    cachedResult,
    compileOptions,
    dirtyEntryId,
    dirtyReasonSummary,
    filename,
    isDev,
    scanDirty,
    source,
    autoRoutesSignature,
    cachedAutoRoutesSignature,
  } = options

  if (
    !isDev
    || scanDirty
    || !dirtyEntryId
    || !cachedResult
    || !filename.endsWith('.vue')
    || cachedAutoRoutesSignature !== autoRoutesSignature
    || !isVueJsonOnlyDirtyReasonSummary(dirtyReasonSummary)
  ) {
    return undefined
  }

  const refreshed = await refreshVueFileJsonConfig(
    source,
    filename,
    cachedResult,
    compileOptions,
  )
  return refreshed ? normalizeVueTransformResult(refreshed) : undefined
}
