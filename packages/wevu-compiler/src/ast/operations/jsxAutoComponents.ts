import type { Expression } from '@babel/types'
import type { JsxAutoComponentContext } from '../../plugins/jsx/compileJsx/types'
import type { AstEngineName } from '../types'
import * as t from '@babel/types'
import {
  collectJsxAutoComponentsFromCode as collectSharedJsxAutoComponentsFromCode,
} from '@weapp-vite/ast'
import { isBuiltinComponent } from '../../auto-import-components/builtin'
import { getObjectPropertyByKey, resolveRenderableExpression } from '../../plugins/jsx/compileJsx/ast'
import { resolveComponentExpression } from '../../plugins/vue/transform/scriptComponent'
import { RESERVED_VUE_COMPONENT_TAGS } from '../../utils/vueTemplateTags'

function isCollectableJsxTemplateTag(tag: string) {
  if (!tag) {
    return false
  }
  if (RESERVED_VUE_COMPONENT_TAGS.has(tag)) {
    return false
  }
  return !isBuiltinComponent(tag)
}

function resolveRenderExpression(componentExpr: Expression) {
  if (!t.isObjectExpression(componentExpr)) {
    return null
  }

  const renderNode = getObjectPropertyByKey(componentExpr, 'render')
  if (!renderNode) {
    return null
  }

  if (!t.isObjectMethod(renderNode) && !t.isObjectProperty(renderNode)) {
    return null
  }

  return resolveRenderableExpression(renderNode)
}

/**
 * 从 JSX 源码中收集自动 usingComponents 所需的导入组件与模板标签。
 */
export function collectJsxAutoComponentsFromCode(
  source: string,
  options?: {
    astEngine?: AstEngineName
  },
): JsxAutoComponentContext {
  return collectSharedJsxAutoComponentsFromCode(source, {
    astEngine: options?.astEngine,
    isCollectableTag: isCollectableJsxTemplateTag,
    isDefineComponentSource(source) {
      return source === 'wevu' || source === 'vue'
    },
    resolveBabelComponentExpression: resolveComponentExpression,
    resolveBabelRenderExpression: resolveRenderExpression,
  })
}
