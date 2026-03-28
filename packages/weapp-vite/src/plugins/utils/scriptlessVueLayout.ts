import * as t from '@weapp-vite/ast/babelTypes'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../utils/babel'

const WEVU_TEMPLATE_RUNTIME_BINDING_ATTR_RE = /(?:^|[\s<])(?:ref|:ref|v-bind:ref|layout-host|:layout-host|v-bind:layout-host)\s*=/

export function hasWevuTemplateRuntimeBindings(template: string | undefined) {
  return typeof template === 'string' && WEVU_TEMPLATE_RUNTIME_BINDING_ATTR_RE.test(template)
}

export function isDefineComponentJsonOnlyScript(content: string) {
  const ast = babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS)
  let hasDefineComponentJson = false

  for (const statement of ast.program.body) {
    if (t.isEmptyStatement(statement)) {
      continue
    }
    if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
      return false
    }
    const call = statement.expression
    if (!t.isIdentifier(call.callee, { name: 'defineComponentJson' })) {
      return false
    }
    hasDefineComponentJson = true
  }

  return hasDefineComponentJson
}

export function shouldEmitScriptlessVueLayoutJs(source: string, filename: string) {
  const { descriptor } = parseSfc(source, { filename })
  if (hasWevuTemplateRuntimeBindings(descriptor.template?.content)) {
    return false
  }
  const blocks = [descriptor.script?.content, descriptor.scriptSetup?.content]
    .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)

  if (blocks.length === 0) {
    return true
  }

  return blocks.every(isDefineComponentJsonOnlyScript)
}
