import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { VueTransformResult } from './types'
import { compileVueStyleToWxss } from '../../compiler/style'
import { generateScopedId } from '../scopedId'

export async function compileStylePhase(
  descriptor: Pick<SFCDescriptor, 'styles'>,
  filename: string,
  result: VueTransformResult,
  options?: {
    preserveDeepSelectors?: boolean
    transformScoped?: boolean
  },
) {
  if (descriptor.styles.length === 0) {
    return { usesSlotted: false }
  }

  const scopedId = generateScopedId(filename)

  const compiledStyles = await Promise.all(descriptor.styles.map(async (styleBlock) => {
    return await compileVueStyleToWxss(styleBlock, {
      id: scopedId,
      filename,
      scoped: styleBlock.scoped,
      modules: styleBlock.module,
      preserveDeepSelectors: options?.preserveDeepSelectors,
      transformScoped: options?.transformScoped,
    })
  }))

  result.style = compiledStyles
    .map(s => s.code.trim())
    .filter(Boolean)
    .join('\n\n')

  const hasModules = compiledStyles.some(s => s.modules)
  if (!hasModules) {
    return { usesSlotted: compiledStyles.some(style => style.usesSlotted) }
  }

  const modulesMap: Record<string, Record<string, string>> = {}

  compiledStyles.forEach((compiled) => {
    if (compiled.modules) {
      Object.assign(modulesMap, compiled.modules)
    }
  })

  result.cssModules = modulesMap

  return { usesSlotted: compiledStyles.some(style => style.usesSlotted) }
}
