import type { NodePath } from '@babel/traverse'
import type { File as BabelFile } from '@babel/types'
import type { WevuDefaults } from 'wevu'
import type { WevuPageFeatureFlag } from '../../wevu/pageFeatures'
import * as t from '@babel/types'
import { WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import logger from '../../../logger'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../utils/babel'
import { collectWevuPageFeatureFlags, injectWevuPageFeatureFlagsIntoOptionsObject } from '../../wevu/pageFeatures'
import { resolveComponentExpression, unwrapDefineComponent } from './scriptComponent'
import { ensureRuntimeImport } from './scriptRuntimeImport'
import { injectTemplateComponentMeta } from './scriptTemplateMeta'
import { vueSfcTransformPlugin } from './scriptVueSfcTransform'

/**
 * 使用 Babel AST 转换脚本
 * 比正则替换更健壮，能处理复杂的代码结构
 */
export interface TransformResult {
  code: string
  transformed: boolean
}

export interface TransformScriptOptions {
  /**
   * 是否跳过组件转换（不添加 createWevuComponent 调用）
   * 用于 app.vue 等入口文件
   */
  skipComponentTransform?: boolean
  /**
   * 是否是 App 入口（app.vue）
   * App 需要调用 wevu 的 createApp() 来注册小程序 App 并挂载 app hooks。
   */
  isApp?: boolean
  /**
   * 是否是 Page 入口（仅 Page 才需要注入 features 以启用按需派发的页面事件）
   */
  isPage?: boolean
  /**
   * <script setup> 中引入的组件：编译时移除 import，并提供同名元信息对象占位，避免运行时访问时报错。
   * key: 组件别名（需与模板标签一致），value: usingComponents 的 from（如 `/components/foo/index`）
   */
  templateComponentMeta?: Record<string, string>
  /**
   * wevu 默认值（仅用于 app.vue 注入）
   */
  wevuDefaults?: WevuDefaults
}

type OptionalPatternNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.VoidPattern

type OptionalFlagNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.ClassProperty
    | t.ClassPrivateProperty
    | t.ClassMethod
    | t.ClassPrivateMethod
    | t.ClassAccessorProperty

function isOptionalPatternNode(node: t.Node | null | undefined): node is OptionalPatternNode {
  return (
    t.isIdentifier(node)
    || t.isAssignmentPattern(node)
    || t.isRestElement(node)
    || t.isArrayPattern(node)
    || t.isObjectPattern(node)
    || t.isVoidPattern(node)
  )
}

function stripOptionalFlag(node: OptionalFlagNode | null | undefined) {
  if (node?.optional !== true) {
    return false
  }
  node.optional = false
  return true
}

function stripOptionalFromPattern(
  pattern: t.FunctionParameter | t.TSParameterProperty | null | undefined,
): boolean {
  if (!pattern) {
    return false
  }
  if (t.isTSParameterProperty(pattern)) {
    return stripOptionalFromPattern(pattern.parameter)
  }
  let changed = false
  if (
    t.isIdentifier(pattern)
    || t.isAssignmentPattern(pattern)
    || t.isRestElement(pattern)
    || t.isArrayPattern(pattern)
    || t.isObjectPattern(pattern)
  ) {
    changed = stripOptionalFlag(pattern) || changed
  }

  if (t.isIdentifier(pattern) || t.isVoidPattern(pattern)) {
    return changed
  }
  if (t.isAssignmentPattern(pattern)) {
    if (isOptionalPatternNode(pattern.left)) {
      changed = stripOptionalFromPattern(pattern.left) || changed
    }
    return changed
  }
  if (t.isRestElement(pattern)) {
    if (isOptionalPatternNode(pattern.argument)) {
      changed = stripOptionalFromPattern(pattern.argument) || changed
    }
    return changed
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        if (isOptionalPatternNode(prop.argument) && stripOptionalFromPattern(prop.argument)) {
          changed = true
        }
      }
      else if (t.isObjectProperty(prop)) {
        if (isOptionalPatternNode(prop.value) && stripOptionalFromPattern(prop.value)) {
          changed = true
        }
      }
    }
    return changed
  }
  if (t.isArrayPattern(pattern)) {
    for (const element of pattern.elements) {
      if (isOptionalPatternNode(element) && stripOptionalFromPattern(element)) {
        changed = true
      }
    }
  }

  return changed
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function isStaticObjectKeyMatch(key: t.Expression | t.PrivateName, expected: string) {
  if (t.isIdentifier(key)) {
    return key.name === expected
  }
  if (t.isStringLiteral(key)) {
    return key.value === expected
  }
  return false
}

function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if (isStaticObjectKeyMatch(prop.key, key)) {
      return prop
    }
  }
  return null
}

function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}

function mergePlainDefaultsIntoObjectExpression(
  target: t.ObjectExpression,
  defaults: Record<string, any>,
): boolean {
  const entries = Object.entries(defaults)
  if (!entries.length) {
    return false
  }
  let changed = false
  const injectedProps: t.ObjectProperty[] = []

  for (const [key, value] of entries) {
    if (getObjectPropertyByKey(target, key)) {
      continue
    }
    injectedProps.push(t.objectProperty(createStaticObjectKey(key), t.valueToNode(value)))
  }

  if (!injectedProps.length) {
    return false
  }

  // 关键：将默认值放在最前，确保后续已有字段/展开能覆盖。
  target.properties.splice(0, 0, ...injectedProps)
  changed = true

  return changed
}

function mergeNestedDefaults(
  optionsObject: t.ObjectExpression,
  key: 'options' | 'setData',
  defaultsValue: unknown,
): boolean {
  if (!isPlainRecord(defaultsValue)) {
    if (defaultsValue === undefined) {
      return false
    }
    const existing = getObjectPropertyByKey(optionsObject, key)
    if (existing) {
      return false
    }
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(defaultsValue)),
    )
    return true
  }

  const existing = getObjectPropertyByKey(optionsObject, key)
  if (!existing) {
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(defaultsValue)),
    )
    return true
  }

  if (t.isObjectExpression(existing.value)) {
    return mergePlainDefaultsIntoObjectExpression(existing.value, defaultsValue)
  }

  if (t.isIdentifier(existing.value) || t.isMemberExpression(existing.value)) {
    const injected = t.valueToNode(defaultsValue)
    if (t.isObjectExpression(injected)) {
      injected.properties.push(t.spreadElement(t.cloneNode(existing.value, true)))
      existing.value = injected
      return true
    }
  }

  return false
}

function applyWevuDefaultsToOptionsObject(
  optionsObject: t.ObjectExpression,
  defaults: Record<string, any>,
): boolean {
  let changed = false
  for (const [key, value] of Object.entries(defaults)) {
    if (key === 'setData' || key === 'options') {
      changed = mergeNestedDefaults(optionsObject, key, value) || changed
      continue
    }
    if (value === undefined || getObjectPropertyByKey(optionsObject, key)) {
      continue
    }
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), t.valueToNode(value)),
    )
    changed = true
  }
  return changed
}

function ensureNestedOptionValue(
  optionsObject: t.ObjectExpression,
  key: 'options' | 'setData',
  nestedKey: string,
  value: unknown,
): boolean {
  const existing = getObjectPropertyByKey(optionsObject, key)
  if (!existing) {
    const nested = t.objectExpression([
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
    ])
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(key), nested),
    )
    return true
  }

  if (t.isObjectExpression(existing.value)) {
    if (getObjectPropertyByKey(existing.value, nestedKey)) {
      return false
    }
    existing.value.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
    )
    return true
  }

  if (t.isIdentifier(existing.value) || t.isMemberExpression(existing.value)) {
    const wrapped = t.objectExpression([
      t.objectProperty(createStaticObjectKey(nestedKey), t.valueToNode(value)),
      t.spreadElement(t.cloneNode(existing.value, true)),
    ])
    existing.value = wrapped
    return true
  }

  return false
}

function stripVirtualHostFromDefaults(defaults: Record<string, any>): Record<string, any> {
  const next = { ...defaults }
  const options = next.options
  if (!isPlainRecord(options)) {
    return next
  }
  if (!Object.prototype.hasOwnProperty.call(options, 'virtualHost')) {
    return next
  }
  const copiedOptions = { ...options }
  delete copiedOptions.virtualHost
  if (Object.keys(copiedOptions).length > 0) {
    next.options = copiedOptions
  }
  else {
    delete next.options
  }
  return next
}

function serializeWevuDefaults(defaults: WevuDefaults): string | undefined {
  const seen = new Set<unknown>()
  try {
    return JSON.stringify(defaults, (_key, value) => {
      if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        throw new TypeError('Wevu defaults must be JSON-serializable')
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          throw new Error('Wevu defaults must not be circular')
        }
        seen.add(value)
        if (!Array.isArray(value) && !isPlainRecord(value)) {
          throw new Error('Wevu defaults must be plain objects or arrays')
        }
      }
      return value
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[vue] Failed to serialize wevu defaults: ${message}`)
    return undefined
  }
}

function insertWevuDefaultsCall(program: t.Program, serializedDefaults: string) {
  const callStatement = t.expressionStatement(
    t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.setWevuDefaults), [
      t.valueToNode(JSON.parse(serializedDefaults)),
    ]),
  )
  let insertIndex = 0
  while (insertIndex < program.body.length && t.isImportDeclaration(program.body[insertIndex])) {
    insertIndex += 1
  }
  program.body.splice(insertIndex, 0, callStatement)
}

export function transformScript(source: string, options?: TransformScriptOptions): TransformResult {
  const ast: BabelFile = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS)

  const defineComponentAliases = new Set<string>([WE_VU_RUNTIME_APIS.defineComponent, '_defineComponent'])
  const defineComponentDecls = new Map<string, t.ObjectExpression>()
  let defaultExportPath: NodePath<t.ExportDefaultDeclaration> | null = null
  let transformed = false

  const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'
  const enabledPageFeatures: Set<WevuPageFeatureFlag> = options?.isPage
    ? collectWevuPageFeatureFlags(ast)
    : new Set<WevuPageFeatureFlag>()
  const serializedWevuDefaults = options?.wevuDefaults && Object.keys(options.wevuDefaults).length > 0
    ? serializeWevuDefaults(options.wevuDefaults)
    : undefined
  const parsedWevuDefaults: WevuDefaults | undefined = serializedWevuDefaults
    ? JSON.parse(serializedWevuDefaults)
    : undefined

  // 先运行 Vue SFC 转换插件
  traverse(ast, vueSfcTransformPlugin().visitor as any)

  traverse(ast, {
    ObjectMethod(path) {
      if (!t.isIdentifier(path.node.key, { name: 'setup' }) && !t.isStringLiteral(path.node.key, { value: 'setup' })) {
        return
      }
      const params = path.node.params
      if (params.length < 2 || !t.isObjectPattern(params[1])) {
        return
      }

      // Vue <script setup> 中 defineExpose 会被编译成：
      // setup(__props, { expose: __expose }) { __expose({ ... }) }
      // 这里将内部的 __expose 对齐为 wevu 的 expose（若不冲突）。
      const ctxParam = params[1]
      const hasVueExposeAlias = ctxParam.properties.some((property) => {
        if (!t.isObjectProperty(property)) {
          return false
        }
        return (
          t.isIdentifier(property.key, { name: 'expose' })
          && t.isIdentifier(property.value, { name: '__expose' })
        )
      })
      if (hasVueExposeAlias && path.scope.hasBinding('__expose') && !path.scope.hasBinding('expose')) {
        path.scope.rename('__expose', 'expose')
        transformed = true

        // 重命名后参数可能变成 `({ expose: expose })`，转成更简洁的 `({ expose })`
        for (const property of ctxParam.properties) {
          if (!t.isObjectProperty(property)) {
            continue
          }
          if (
            t.isIdentifier(property.key, { name: 'expose' })
            && t.isIdentifier(property.value, { name: 'expose' })
          ) {
            property.shorthand = true
          }
        }
      }
    },

    ImportDeclaration(path) {
      // 移除 defineComponent 的导入，同时记录本地别名
      if (path.node.source.value === 'vue') {
        const movedVueRuntimeAPIs = new Set([
          'useAttrs',
          'useSlots',
          'useModel',
          'mergeModels',
        ])

        // 将 Vue SFC 编译产物中的部分 Vue runtime API 迁移到 wevu：
        // - defineSlots() => useSlots()
        // - defineModel() => useModel()/mergeModels()
        // - useAttrs()/useSlots()（用户手动导入）
        const movedSpecifiers: Array<{ importedName: string, localName: string }> = []

        const remaining = path.node.specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier) && specifier.imported.type === 'Identifier' && specifier.imported.name === WE_VU_RUNTIME_APIS.defineComponent) {
            defineComponentAliases.add(specifier.local.name)
            transformed = true
            return false
          }

          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            const importedName = specifier.imported.name
            if (movedVueRuntimeAPIs.has(importedName) && t.isIdentifier(specifier.local)) {
              movedSpecifiers.push({ importedName, localName: specifier.local.name })
              transformed = true
              return false
            }
          }
          return true
        })

        if (movedSpecifiers.length) {
          for (const { importedName, localName } of movedSpecifiers) {
            ensureRuntimeImport(ast.program, importedName, localName)
          }
        }

        if (remaining.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = remaining
      }

      // 剔除 type-only 导入
      if (path.node.importKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      const kept = path.node.specifiers.filter((specifier) => {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          transformed = true
          return false
        }
        return true
      })
      if (kept.length !== path.node.specifiers.length) {
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }
    },

    ExportNamedDeclaration(path) {
      if (path.node.exportKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      if (path.node.specifiers?.length) {
        const remaining = path.node.specifiers.filter((spec) => {
          if (t.isExportSpecifier(spec)) {
            return spec.exportKind !== 'type'
          }
          return true
        })
        if (remaining.length !== path.node.specifiers.length) {
          transformed = true
          if (remaining.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = remaining
        }
      }
    },

    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
      }
      const unwrapped = unwrapDefineComponent(path.node.init, defineComponentAliases)
      if (unwrapped) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(unwrapped, true))
        path.node.init = unwrapped
        transformed = true
      }
    },

    ExportDefaultDeclaration(path) {
      defaultExportPath = path
    },

    CallExpression(path) {
      // 移除 __expose() 调用
      if (t.isIdentifier(path.node.callee, { name: '__expose' }) && path.parentPath?.isExpressionStatement()) {
        // 空参数时是 Vue 编译器注入的默认暴露调用；有参数时为 defineExpose 产物，需要保留。
        if (path.node.arguments.length === 0) {
          path.parentPath.remove()
          transformed = true
          return
        }
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    NewExpression(path) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: '__name' })
        || t.isStringLiteral(path.node.key, { value: '__name' })
      ) {
        path.remove()
        transformed = true
      }
    },

    TSTypeAliasDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSInterfaceDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSEnumDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSModuleDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSImportEqualsDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSAsExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAssertion(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSNonNullExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAnnotation(path) {
      path.remove()
      transformed = true
    },

    TSParameterProperty(path) {
      path.replaceWith(path.node.parameter)
      transformed = true
    },

    Function(path) {
      if (path.node.returnType) {
        path.node.returnType = null
        transformed = true
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
      for (const param of path.node.params) {
        if (stripOptionalFromPattern(param)) {
          transformed = true
        }
      }
    },

    ClassMethod(path) {
      if (stripOptionalFlag(path.node)) {
        transformed = true
      }
    },

    ClassPrivateMethod(path) {
      if (stripOptionalFlag(path.node)) {
        transformed = true
      }
    },

    ClassAccessorProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        transformed = true
      }
    },

    ClassProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        transformed = true
      }
    },

    ClassPrivateProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        transformed = true
      }
    },
  })

  // <script setup> 组件导入自动注册：移除 import，并注入元信息对象（满足用户在 script 中访问/打印的需求）
  if (options?.templateComponentMeta) {
    transformed = injectTemplateComponentMeta(ast, options.templateComponentMeta) || transformed
  }

  // 处理 export default，注入 createWevuComponent 调用或直接解包 defineComponent
  if (defaultExportPath) {
    const exportPath = defaultExportPath as NodePath<t.ExportDefaultDeclaration>
    const componentExpr = resolveComponentExpression(
      exportPath.node.declaration,
      defineComponentDecls,
      defineComponentAliases,
    )

    if (componentExpr && t.isObjectExpression(componentExpr) && enabledPageFeatures.size) {
      transformed = injectWevuPageFeatureFlagsIntoOptionsObject(componentExpr, enabledPageFeatures) || transformed
    }

    if (componentExpr && t.isObjectExpression(componentExpr) && parsedWevuDefaults) {
      if (options?.isApp && parsedWevuDefaults.app && Object.keys(parsedWevuDefaults.app).length > 0) {
        transformed = applyWevuDefaultsToOptionsObject(componentExpr, parsedWevuDefaults.app) || transformed
      }

      if (!options?.isApp && parsedWevuDefaults.component && Object.keys(parsedWevuDefaults.component).length > 0) {
        const componentDefaults = options?.isPage
          ? stripVirtualHostFromDefaults(parsedWevuDefaults.component as Record<string, any>)
          : (parsedWevuDefaults.component as Record<string, any>)
        if (Object.keys(componentDefaults).length > 0) {
          transformed = applyWevuDefaultsToOptionsObject(componentExpr, componentDefaults) || transformed
        }
      }

      const componentOptionDefaults = parsedWevuDefaults.component?.options
      if (
        options?.isPage
        && isPlainRecord(componentOptionDefaults)
        && componentOptionDefaults.virtualHost === true
      ) {
        transformed = ensureNestedOptionValue(componentExpr, 'options', 'virtualHost', false) || transformed
      }
    }

    if (componentExpr && options?.isApp) {
      if (serializedWevuDefaults) {
        ensureRuntimeImport(ast.program, WE_VU_RUNTIME_APIS.setWevuDefaults)
        insertWevuDefaultsCall(ast.program, serializedWevuDefaults)
        transformed = true
      }
      ensureRuntimeImport(ast.program, WE_VU_RUNTIME_APIS.createApp)
      exportPath.replaceWith(
        t.expressionStatement(
          t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.createApp), [
            componentExpr,
          ]),
        ),
      )
      transformed = true
    }
    else if (componentExpr && options?.skipComponentTransform) {
      exportPath.replaceWith(t.exportDefaultDeclaration(componentExpr))
      transformed = true
    }
    else if (componentExpr) {
      ensureRuntimeImport(ast.program, WE_VU_RUNTIME_APIS.createWevuComponent)
      exportPath.replaceWith(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(DEFAULT_OPTIONS_IDENTIFIER), componentExpr),
        ]),
      )
      exportPath.insertAfter(
        t.expressionStatement(
          t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.createWevuComponent), [
            t.identifier(DEFAULT_OPTIONS_IDENTIFIER),
          ]),
        ),
      )
      transformed = true
    }
  }

  if (!transformed) {
    return {
      code: source,
      transformed: false,
    }
  }

  const generated = generate(ast, {
    retainLines: true,
  })

  return {
    code: generated.code,
    transformed,
  }
}
