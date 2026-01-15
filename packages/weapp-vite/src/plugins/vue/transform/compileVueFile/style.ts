import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { VueTransformResult } from './types'
import { compileVueStyleToWxss } from '../../compiler/style'
import { generateScopedId } from '../scopedId'

export function compileStylePhase(
  descriptor: Pick<SFCDescriptor, 'styles'>,
  filename: string,
  result: VueTransformResult,
) {
  if (descriptor.styles.length === 0) {
    return
  }

  const scopedId = generateScopedId(filename)

  const compiledStyles = descriptor.styles.map((styleBlock) => {
    return compileVueStyleToWxss(styleBlock, {
      id: scopedId,
      scoped: styleBlock.scoped,
      modules: styleBlock.module,
    })
  })

  result.style = compiledStyles
    .map(s => s.code.trim())
    .filter(Boolean)
    .join('\n\n')

  const hasModules = compiledStyles.some(s => s.modules)
  if (!hasModules) {
    return
  }

  const modulesMap: Record<string, Record<string, string>> = {}

  compiledStyles.forEach((compiled) => {
    if (compiled.modules) {
      Object.assign(modulesMap, compiled.modules)
    }
  })

  result.cssModules = modulesMap

  if (result.script !== undefined) {
    result.script = `
// 模块化样式（CSS Modules）
const __cssModules = ${JSON.stringify(modulesMap, null, 2)}
${result.script}
`
  }
}
