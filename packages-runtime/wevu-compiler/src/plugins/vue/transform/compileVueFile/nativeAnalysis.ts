import type { TemplateChildNode } from '@vue/compiler-core'
import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import type { SFCDescriptor, SFCScriptBlock, SFCTemplateBlock } from 'vue/compiler-sfc'
import { NodeTypes } from '@vue/compiler-core'
import { analyzeCompilerScriptsWithNative } from '@weapp-vite/ast'
import { isBuiltinComponent } from '../../../../auto-import-components/builtin'
import { RESERVED_VUE_COMPONENT_TAGS } from '../../../../utils/vueTemplateTags'
import { mayHaveDefaultExport } from './defaultExport'

/** 普通脚本的局部组件与默认导出检查可共享摘要；内置标签不触发额外 native 往返。 */
export function mayShareNativeOptionsAnalysis(scriptCode: string, template: SFCTemplateBlock | null | undefined) {
  if (!template?.ast || template.src || !mayHaveDefaultExport(scriptCode)) {
    return false
  }
  // 复用 SFC 已解析的模板 AST，属性与插值中的标签文本不会新增 native 往返。
  const hasComponentTag = (node: TemplateChildNode): boolean => {
    if (node.type !== NodeTypes.ELEMENT) {
      return false
    }
    if (!RESERVED_VUE_COMPONENT_TAGS.has(node.tag) && !isBuiltinComponent(node.tag)) {
      return true
    }
    return node.children.some(hasComponentTag)
  }
  return template.ast.children.some(hasComponentTag)
}

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
