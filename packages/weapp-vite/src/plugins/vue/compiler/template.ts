import type { TemplateCompileResult, TransformContext } from './template/types'
import {
  baseParse as parse,
} from '@vue/compiler-core'
import { transformNode } from './template/nodes'

export type { TemplateCompileResult } from './template/types'

export function compileVueTemplateToWxml(
  template: string,
  filename: string,
): TemplateCompileResult {
  const warnings: string[] = []

  try {
    // 使用 Vue compiler-core 解析模板
    const ast = parse(template, {
      onError: (error) => {
        warnings.push(`Template parse error: ${error.message}`)
      },
    })

    const context: TransformContext = {
      source: template,
      filename,
      warnings,
    }

    // 转换 AST 到 WXML
    const wxml = ast.children
      .map(child => transformNode(child, context))
      .join('')

    return {
      code: wxml,
      warnings,
    }
  }
  catch (error) {
    warnings.push(`Failed to compile template: ${error}`)
    return {
      code: template,
      warnings,
    }
  }
}
