import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { SfcStylePreprocessOptions } from './compileOptions'
import { compileVueStyleToWxss, generateScopedId } from 'wevu/compiler'

function hasCssModules(styleBlocks: SFCStyleBlock[] | undefined) {
  return styleBlocks?.some(styleBlock => Boolean(styleBlock.module)) === true
}

export function hasSameCssVars(previous: string[] | undefined, current: string[] | undefined) {
  if (!previous || !current || previous.length !== current.length) {
    return false
  }
  return previous.every((expression, index) => expression === current[index])
}

export async function refreshStyleOnlyVueTransformResult(
  result: VueTransformResult,
  filename: string,
  styleBlocks: SFCStyleBlock[] | undefined,
  cssVars: string[] | undefined,
  stylePreprocessOptions?: SfcStylePreprocessOptions,
) {
  if (
    !styleBlocks
    || hasCssModules(styleBlocks)
    || !hasSameCssVars(result.meta?.cssVars, cssVars)
  ) {
    return false
  }

  if (!styleBlocks.length) {
    result.style = undefined
    if (result.meta) {
      result.meta.cssVars = cssVars
      result.meta.styleBlocks = styleBlocks
    }
    return true
  }

  const scopedId = generateScopedId(filename)
  const style = (await Promise.all(styleBlocks.map(async styleBlock => await compileVueStyleToWxss(styleBlock, {
    id: scopedId,
    filename,
    scoped: styleBlock.scoped,
    modules: styleBlock.module,
    preprocessOptions: stylePreprocessOptions?.[styleBlock.lang || 'css'],
  })))).map(result => result.code.trim()).filter(Boolean).join('\n\n')

  result.style = style || undefined
  if (result.meta) {
    result.meta.cssVars = cssVars
    result.meta.styleBlocks = styleBlocks
  }
  return true
}
