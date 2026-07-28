import type { LoadFontFaceOptions } from './types'
import { callMiniProgramAsyncFailure, callMiniProgramAsyncSuccess } from './async'

function installFallbackFontFace(options: LoadFontFaceOptions) {
  if (typeof document === 'undefined') {
    throw new Error('document is unavailable')
  }
  const style = document.createElement('style')
  style.dataset.weappFontFamily = options.family
  style.textContent = `@font-face{font-family:${JSON.stringify(options.family)};src:${options.source};}`
  document.head.append(style)
}

export async function loadFontFace(options: LoadFontFaceOptions) {
  const family = options?.family?.trim()
  const source = options?.source?.trim()
  if (!family || !source) {
    return callMiniProgramAsyncFailure(options, 'loadFontFace:fail invalid options')
  }

  try {
    if (
      typeof FontFace === 'function'
      && typeof document !== 'undefined'
      && document.fonts
      && typeof document.fonts.add === 'function'
    ) {
      const fontFace = new FontFace(family, source, options.descriptors)
      document.fonts.add(await fontFace.load())
    }
    else {
      installFallbackFontFace({ ...options, family, source })
    }
    return callMiniProgramAsyncSuccess(options, { errMsg: 'loadFontFace:ok' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return callMiniProgramAsyncFailure(options, `loadFontFace:fail ${message}`)
  }
}
