import type { File } from '@babel/types'
import type { CompileVueFileOptions } from '../../vue/transform/compileVueFile/types'
import type { JsxCompileContext } from './types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../utils/babel'
import { wechatPlatform } from '../../vue/compiler/template/platforms'
import { collectJsxAutoComponentContext, findJsxRenderExpression } from './analysis'
import { compileRenderableExpression } from './render'

export function createJsxCompileContext(options?: CompileVueFileOptions): JsxCompileContext {
  return {
    platform: options?.template?.platform ?? wechatPlatform,
    mustacheInterpolation: options?.template?.mustacheInterpolation ?? 'compact',
    warnings: [],
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scopeStack: [],
  }
}

export function compileJsxTemplate(source: string, filename: string, options?: CompileVueFileOptions) {
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  const context = createJsxCompileContext(options)

  const renderExpression = findJsxRenderExpression(ast, context)
  if (!renderExpression) {
    context.warnings = context.warnings.map(message => (
      message === '未识别到默认导出组件。'
        ? `未在 ${filename} 中识别到默认导出组件。`
        : message
    ))
    return {
      template: undefined,
      warnings: context.warnings,
      inlineExpressions: context.inlineExpressions,
    }
  }

  const template = compileRenderableExpression(renderExpression, context)
  return {
    template,
    warnings: context.warnings,
    inlineExpressions: context.inlineExpressions,
  }
}

export function collectJsxAutoComponents(source: string, filename: string, options?: CompileVueFileOptions) {
  const context = createJsxCompileContext(options)
  return collectJsxAutoComponentContext(source, filename, context, options?.warn)
}
