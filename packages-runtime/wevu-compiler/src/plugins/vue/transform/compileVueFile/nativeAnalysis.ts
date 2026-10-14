import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import type { SFCDescriptor, SFCScriptBlock } from 'vue/compiler-sfc'
import { analyzeCompilerScriptsWithNative } from '@weapp-vite/ast'

function resolveScriptFilename(filename: string, lang?: string | null) {
  const extension = lang === 'tsx' || lang === 'jsx' || lang === 'js' ? lang : 'ts'
  return `${filename}.${extension}`
}

/** 原始宏与预处理后的脚本一次提交；相同源码由 native 复用解析。 */
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
    const results = analyzeCompilerScriptsWithNative(blocks.map(([, block]) => ({
      code: block.content,
      filename: resolveScriptFilename(filename, block.lang),
    })))
    if (!results || results.length !== blocks.length) {
      return undefined
    }
    const scripts: { script?: NativeCompilerScriptAnalysis, scriptSetup?: NativeCompilerScriptAnalysis } = {}
    let defineOptions: NativeCompilerScriptAnalysis | undefined
    for (const [index, [key]] of blocks.entries()) {
      const result = results[index]
      if (!result) {
        continue
      }
      if (key === 'defineOptions') {
        defineOptions = result
      }
      else {
        scripts[key] = result
      }
    }
    return { scripts, defineOptions }
  }
  catch {
    // 可选 native 异常只影响摘要消费，原有 Babel/Oxc 路径继续负责语义和错误。
    return undefined
  }
}
