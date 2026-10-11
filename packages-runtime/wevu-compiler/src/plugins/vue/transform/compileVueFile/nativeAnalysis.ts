import type { NativeCompilerScriptAnalysis, NativeCompilerScriptInput } from '@weapp-vite/ast'
import type { SFCDescriptor, SFCScriptBlock } from 'vue/compiler-sfc'
import { analyzeCompilerScriptsWithNative } from '@weapp-vite/ast'

function resolveScriptFilename(filename: string, lang?: string | null) {
  const extension = lang === 'tsx' || lang === 'jsx' || lang === 'js' ? lang : 'ts'
  return `${filename}.${extension}`
}

/** 同源角色保持各自可变摘要的所有权，不共享 native 返回的容器。 */
function cloneScriptAnalysis(analysis: NativeCompilerScriptAnalysis): NativeCompilerScriptAnalysis {
  return {
    ...analysis,
    imports: analysis.imports.map(item => ({ ...item })),
    defineOptionsStatements: analysis.defineOptionsStatements.map(span => ({ ...span })),
    featureFlags: [...analysis.featureFlags],
    ...(analysis.registeredComponents
      ? { registeredComponents: analysis.registeredComponents.map(item => ({ ...item })) }
      : {}),
    ...(analysis.reservedPropsDiagnostic
      ? { reservedPropsDiagnostic: { ...analysis.reservedPropsDiagnostic } }
      : {}),
  }
}

/** 原始宏与预处理后的脚本一次提交，同源码及解析模式只跨边界传输和校验一次。 */
export function analyzeNativeScriptBlocks(
  descriptor: SFCDescriptor,
  filename: string,
  defineOptionsSource?: SFCScriptBlock,
) {
  const blocks = ([
    ['script', descriptor.script],
    ['scriptSetup', descriptor.scriptSetup],
    ['defineOptions', defineOptionsSource],
  ] as const).filter((entry): entry is [typeof entry[0], SFCScriptBlock] => Boolean(entry[1]))
  if (!blocks.length) {
    return undefined
  }
  try {
    const inputs: NativeCompilerScriptInput[] = []
    const inputIndices = blocks.map(([, block]) => {
      const resolvedFilename = resolveScriptFilename(filename, block.lang)
      const index = inputs.findIndex(input => input.code === block.content && input.filename === resolvedFilename)
      if (index >= 0) {
        return index
      }
      inputs.push({ code: block.content, filename: resolvedFilename })
      return inputs.length - 1
    })
    const results = analyzeCompilerScriptsWithNative(inputs)
    if (!results || results.length !== inputs.length) {
      return undefined
    }
    const scripts: { script?: NativeCompilerScriptAnalysis, scriptSetup?: NativeCompilerScriptAnalysis } = {}
    let defineOptions: NativeCompilerScriptAnalysis | undefined
    const assigned = new Set<number>()
    for (const [index, [key]] of blocks.entries()) {
      const inputIndex = inputIndices[index]!
      const result = results[inputIndex]
      if (!result) {
        continue
      }
      const analysis = assigned.has(inputIndex) ? cloneScriptAnalysis(result) : result
      assigned.add(inputIndex)
      if (key === 'defineOptions') {
        defineOptions = analysis
      }
      else {
        scripts[key] = analysis
      }
    }
    return { scripts, defineOptions }
  }
  catch {
    // 可选 native 异常只影响摘要消费，原有 Babel/Oxc 路径继续负责语义和错误。
    return undefined
  }
}
