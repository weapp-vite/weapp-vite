import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import { compileVueStyleToWxss, generateScopedId } from 'wevu/compiler'

function hasCssModules(styleBlocks: SFCStyleBlock[] | undefined) {
  return styleBlocks?.some(styleBlock => Boolean(styleBlock.module)) === true
}

export async function refreshStyleOnlyVueTransformResult(
  result: VueTransformResult,
  filename: string,
  styleBlocks: SFCStyleBlock[] | undefined,
) {
  if (!styleBlocks || hasCssModules(styleBlocks)) {
    return false
  }

  if (!styleBlocks.length) {
    result.style = undefined
    return true
  }

  const scopedId = generateScopedId(filename)
  const style = (await Promise.all(styleBlocks.map(async styleBlock => await compileVueStyleToWxss(styleBlock, { id: scopedId, filename, scoped: styleBlock.scoped, modules: styleBlock.module })))).map(result => result.code.trim()).filter(Boolean).join('\n\n')

  result.style = style || undefined
  return true
}
