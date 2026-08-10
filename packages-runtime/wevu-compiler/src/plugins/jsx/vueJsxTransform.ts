import type { EncodedSourceMapLike } from '../../utils/sourcemap'
import vueJsxPlugin from '@vue/babel-plugin-jsx'
import { transformSync } from '@weapp-vite/ast/babelCore'
import * as t from '@weapp-vite/ast/babelTypes'

export interface VueJsxTransformOptions {
  enableObjectSlots?: boolean
  mergeProps?: boolean
  optimize?: boolean
  resolveType?: boolean
  transformOn?: boolean
}

export const DEFAULT_VUE_JSX_TRANSFORM_OPTIONS: Required<VueJsxTransformOptions> = {
  enableObjectSlots: true,
  mergeProps: true,
  optimize: true,
  resolveType: false,
  transformOn: true,
}

function readDirectiveExpression(attribute: t.JSXAttribute) {
  if (!attribute.value) {
    return t.booleanLiteral(true)
  }
  if (!t.isJSXExpressionContainer(attribute.value) || t.isJSXEmptyExpression(attribute.value.expression)) {
    return undefined
  }
  return t.isExpression(attribute.value.expression) ? attribute.value.expression : undefined
}

function createWevuJsxDirectiveCompatibilityPlugin() {
  return {
    name: 'wevu-jsx-directive-compatibility',
    visitor: {
      JSXElement(path: any) {
        const attributes = path.node.openingElement.attributes as Array<t.JSXAttribute | t.JSXSpreadAttribute>
        let ifExpression: t.Expression | undefined
        let textExpression: t.Expression | undefined
        path.node.openingElement.attributes = attributes.filter((attribute) => {
          if (!t.isJSXAttribute(attribute)) {
            return true
          }
          const name = t.isJSXIdentifier(attribute.name)
            ? attribute.name.name
            : t.isJSXNamespacedName(attribute.name)
              ? attribute.name.namespace.name
              : undefined
          if (name === 'v-if') {
            ifExpression = readDirectiveExpression(attribute)
            return false
          }
          if (name === 'v-text') {
            textExpression = readDirectiveExpression(attribute)
            return false
          }
          if (name?.startsWith('v-') && !['v-html', 'v-model', 'v-models', 'v-show', 'v-slots'].includes(name)) {
            return false
          }
          return true
        })

        if (textExpression) {
          path.node.children = [t.jsxExpressionContainer(textExpression)]
        }
        if (ifExpression) {
          path.replaceWith(t.conditionalExpression(ifExpression, path.node, t.nullLiteral()))
        }
      },
    },
  }
}

export function transformVueJsxScript(
  source: string,
  filename: string,
  sourceMaps = true,
  options?: VueJsxTransformOptions,
) {
  const result = transformSync(source, {
    filename,
    sourceType: 'module',
    sourceMaps,
    plugins: [createWevuJsxDirectiveCompatibilityPlugin, [vueJsxPlugin, { ...DEFAULT_VUE_JSX_TRANSFORM_OPTIONS, ...options }]],
    parserOpts: {
      plugins: ['typescript', 'jsx'],
    },
    generatorOpts: {
      retainLines: !sourceMaps,
    },
  })

  return {
    code: result?.code ?? source,
    map: result?.map
      ? { ...result.map, file: result.map.file ?? undefined } as EncodedSourceMapLike
      : null,
  }
}
