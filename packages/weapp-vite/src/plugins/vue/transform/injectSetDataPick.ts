import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type * as t from '@weapp-vite/ast/babelTypes'
import type { AstEngineName } from '../../../ast'
import type { WeappViteConfig } from '../../../types'
import type { EncodedSourceMapLike } from '../../../utils/sourcemap'
import {
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { collectSetDataPickKeysFromTemplateCode } from '../../../ast'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { isAutoSetDataPickEnabledWithPreset } from './wevuPreset'

const SCOPED_SLOT_OWNER_AUTO_PICK_BIND_KEY_LIMIT = 200
const AUTO_BIND_PICK_KEY_PREFIX = '__wv_bind_'

/**
 * 根据配置判断是否启用自动 setData.pick 注入。
 */
export function isAutoSetDataPickEnabled(config?: WeappViteConfig): boolean {
  return isAutoSetDataPickEnabledWithPreset(config)
}

function isKnownWevuComponentCallee(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  if (callee.type === 'Identifier') {
    return callee.name === 'createWevuComponent' || callee.name === 'defineComponent'
  }
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false
  }
  return callee.property.type === 'Identifier'
    && (callee.property.name === 'createWevuComponent' || callee.property.name === 'defineComponent' || callee.property.name === 'so')
}

/**
 * 通过轻量字符串特征快速判断脚本是否可能需要注入 setData.pick。
 */
export function mayNeedInjectSetDataPickInJs(source: string): boolean {
  return source.includes('createWevuComponent')
    || source.includes('defineComponent')
    || source.includes('__wevu_isPage')
    || source.includes('.so(')
}

function getObjectPropertyByKey(objectExpression: t.ObjectExpression, key: string): t.ObjectProperty | undefined {
  for (const member of objectExpression.properties) {
    if (member.type !== 'ObjectProperty') {
      continue
    }
    if (member.key.type === 'Identifier' && member.key.name === key) {
      return member
    }
    if (member.key.type === 'StringLiteral' && member.key.value === key) {
      return member
    }
  }
  return undefined
}

function hasCompiledWevuOptionsMarker(optionsObject: t.ObjectExpression) {
  return Boolean(getObjectPropertyByKey(optionsObject, '__wevu_isPage'))
}

function unwrapExpression(node: t.Expression): t.Expression {
  let current = node
  while (true) {
    if (current.type === 'TSAsExpression' || current.type === 'TSTypeAssertion' || current.type === 'TSNonNullExpression' || current.type === 'ParenthesizedExpression' || current.type === 'TSSatisfiesExpression') {
      current = current.expression as t.Expression
      continue
    }
    return current
  }
}

function resolveOptionsObjectExpression(
  expression: t.Expression | undefined,
  scope: NodePath['scope'],
): t.ObjectExpression | undefined {
  if (!expression) {
    return undefined
  }
  const unwrapped = unwrapExpression(expression)
  if (unwrapped.type === 'ObjectExpression') {
    return unwrapped
  }
  if (unwrapped.type === 'Identifier') {
    const binding = scope.getBinding(unwrapped.name)
    if (!binding || !binding.path.isVariableDeclarator()) {
      return undefined
    }
    const init = binding.path.node.init
    if (!init || (init.type !== 'ObjectExpression' && init.type !== 'CallExpression' && init.type !== 'Identifier')) {
      return undefined
    }
    return resolveOptionsObjectExpression(init as t.Expression, binding.path.scope)
  }
  if (
    unwrapped.type === 'CallExpression'
    && unwrapped.callee.type === 'MemberExpression'
    && !unwrapped.callee.computed
    && unwrapped.callee.object.type === 'Identifier'
    && unwrapped.callee.object.name === 'Object'
    && unwrapped.callee.property.type === 'Identifier'
    && unwrapped.callee.property.name === 'assign'
  ) {
    for (let i = unwrapped.arguments.length - 1; i >= 0; i--) {
      const arg = unwrapped.arguments[i]
      if (arg.type !== 'SpreadElement') {
        const resolved = resolveOptionsObjectExpression(arg as t.Expression, scope)
        if (resolved) {
          return resolved
        }
      }
    }
  }
  return undefined
}

function createPickArrayExpression(keys: string[]): t.ArrayExpression {
  return {
    type: 'ArrayExpression',
    elements: keys.map(key => ({ type: 'StringLiteral', value: key })),
  }
}

function mergeStableKeys(keys: string[], stableKeys: string[]): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const key of [...keys, ...stableKeys]) {
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(key)
  }
  return merged
}

function mergePickArrayExpression(
  arrayExpression: t.ArrayExpression,
  keys: string[],
): boolean {
  const existing = new Set<string>()
  for (const element of arrayExpression.elements) {
    if (element && element.type === 'StringLiteral') {
      existing.add(element.value)
    }
  }
  let changed = false
  for (const key of keys) {
    if (existing.has(key)) {
      continue
    }
    arrayExpression.elements.push({ type: 'StringLiteral', value: key })
    existing.add(key)
    changed = true
  }
  return changed
}

function injectPickIntoSetDataObject(setDataObject: t.ObjectExpression, keys: string[]): boolean {
  const pickProp = getObjectPropertyByKey(setDataObject, 'pick')
  if (!pickProp) {
    setDataObject.properties.unshift({
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: 'pick' },
      computed: false,
      shorthand: false,
      value: createPickArrayExpression(keys),
    })
    return true
  }
  if (pickProp.value.type !== 'ArrayExpression') {
    return false
  }
  return mergePickArrayExpression(pickProp.value, keys)
}

function injectPickIntoOptionsObject(optionsObject: t.ObjectExpression, keys: string[]): boolean {
  const setDataProp = getObjectPropertyByKey(optionsObject, 'setData')
  if (!setDataProp) {
    optionsObject.properties.unshift({
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: 'setData' },
      computed: false,
      shorthand: false,
      value: {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'pick' },
            computed: false,
            shorthand: false,
            value: createPickArrayExpression(keys),
          },
        ],
      },
    })
    return true
  }

  const setDataValue = unwrapExpression(setDataProp.value as t.Expression)
  if (setDataValue.type === 'ObjectExpression') {
    return injectPickIntoSetDataObject(setDataValue, keys)
  }
  if (
    setDataValue.type === 'Identifier'
    || setDataValue.type === 'MemberExpression'
    || setDataValue.type === 'CallExpression'
  ) {
    setDataProp.value = {
      type: 'ObjectExpression',
      properties: [
        {
          type: 'ObjectProperty',
          key: { type: 'Identifier', name: 'pick' },
          computed: false,
          shorthand: false,
          value: createPickArrayExpression(keys),
        },
        {
          type: 'SpreadElement',
          argument: setDataValue,
        },
      ],
    }
    return true
  }
  return false
}

function createScopedSlotHostPropertyDefinition(typeName: 'String' | 'null', value: string | null): t.ObjectExpression {
  return {
    type: 'ObjectExpression',
    properties: [
      {
        type: 'ObjectProperty',
        key: { type: 'Identifier', name: 'type' },
        computed: false,
        shorthand: false,
        value: typeName === 'String' ? { type: 'Identifier', name: 'String' } : { type: 'NullLiteral' },
      },
      {
        type: 'ObjectProperty',
        key: { type: 'Identifier', name: 'value' },
        computed: false,
        shorthand: false,
        value: value === null ? { type: 'NullLiteral' } : { type: 'StringLiteral', value },
      },
    ],
  }
}

function createScopedSlotHostProperties(): t.ObjectProperty[] {
  return [
    {
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: WEVU_SLOT_NAMES_PROP },
      computed: false,
      shorthand: false,
      value: createScopedSlotHostPropertyDefinition('null', null),
    },
    {
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: WEVU_SLOT_OWNER_ID_PROP },
      computed: false,
      shorthand: false,
      value: createScopedSlotHostPropertyDefinition('String', ''),
    },
    {
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: WEVU_SLOT_SCOPE_KEY },
      computed: false,
      shorthand: false,
      value: createScopedSlotHostPropertyDefinition('null', null),
    },
  ]
}

function injectScopedSlotHostPropertiesIntoObject(propertiesObject: t.ObjectExpression): boolean {
  let changed = false
  for (const prop of createScopedSlotHostProperties().reverse()) {
    const key = prop.key.type === 'Identifier' ? prop.key.name : undefined
    if (!key || getObjectPropertyByKey(propertiesObject, key)) {
      continue
    }
    propertiesObject.properties.unshift(prop)
    changed = true
  }
  return changed
}

function injectScopedSlotHostPropertiesIntoOptionsObject(optionsObject: t.ObjectExpression): boolean {
  const propertiesProp = getObjectPropertyByKey(optionsObject, 'properties')
  if (!propertiesProp) {
    optionsObject.properties.unshift({
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: 'properties' },
      computed: false,
      shorthand: false,
      value: {
        type: 'ObjectExpression',
        properties: createScopedSlotHostProperties(),
      },
    })
    return true
  }

  const propertiesValue = unwrapExpression(propertiesProp.value as t.Expression)
  if (propertiesValue.type === 'ObjectExpression') {
    return injectScopedSlotHostPropertiesIntoObject(propertiesValue)
  }
  if (
    propertiesValue.type === 'Identifier'
    || propertiesValue.type === 'MemberExpression'
    || propertiesValue.type === 'CallExpression'
  ) {
    propertiesProp.value = {
      type: 'ObjectExpression',
      properties: [
        {
          type: 'SpreadElement',
          argument: propertiesValue,
        },
        ...createScopedSlotHostProperties(),
      ],
    }
    return true
  }
  return false
}

function transformTargetWevuOptionsInJs(
  source: string,
  transformOptions: (optionsObject: t.ObjectExpression) => boolean,
): { code: string, transformed: boolean, map?: EncodedSourceMapLike | null } {
  if (!mayNeedInjectSetDataPickInJs(source)) {
    return { code: source, transformed: false }
  }

  const ast = parseJsLike(source)
  const candidateOptions = new Set<t.ObjectExpression>()
  traverse(ast, {
    CallExpression(path) {
      const firstArg = path.node.arguments[0]
      if (!firstArg || firstArg.type === 'SpreadElement') {
        return
      }
      const resolvedOptions = resolveOptionsObjectExpression(firstArg as t.Expression, path.scope)
      if (resolvedOptions && (isKnownWevuComponentCallee(path.node.callee) || hasCompiledWevuOptionsMarker(resolvedOptions))) {
        candidateOptions.add(resolvedOptions)
      }
    },
  })

  if (!candidateOptions.size) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const optionsObject of candidateOptions) {
    changed = transformOptions(optionsObject) || changed
  }
  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, {
    retainLines: true,
    sourceMaps: true,
    sourceFileName: 'inline.js',
  }, source)
  return { code: generated.code, transformed: true, map: generated.map as EncodedSourceMapLike }
}

/**
 * 从编译后的 WXML 模板提取渲染相关的顶层 key。
 */
export function collectSetDataPickKeysFromTemplate(
  template: string,
  options?: {
    astEngine?: AstEngineName
  },
): string[] {
  return collectSetDataPickKeysFromTemplateCode(template, options)
}

/**
 * 判断 scoped slot 宿主页是否应该跳过大规模模板 bind 自动 pick。
 */
export function shouldUseScopedSlotOwnerOnlySetDataPick(pickKeys: string[]): boolean {
  let bindKeyCount = 0
  for (const key of pickKeys) {
    if (key.startsWith(AUTO_BIND_PICK_KEY_PREFIX)) {
      bindKeyCount += 1
      if (bindKeyCount > SCOPED_SLOT_OWNER_AUTO_PICK_BIND_KEY_LIMIT) {
        return true
      }
    }
  }
  return false
}

/**
 * 裁剪 scoped slot 宿主页中过量的自动 bind key，同时保留业务状态 key。
 */
export function pruneScopedSlotOwnerAutoSetDataPickKeys(pickKeys: string[]): string[] {
  if (!shouldUseScopedSlotOwnerOnlySetDataPick(pickKeys)) {
    return pickKeys
  }
  return pickKeys.filter(key => !key.startsWith(AUTO_BIND_PICK_KEY_PREFIX))
}

/**
 * 在 wevu 组件脚本中注入 setData.pick。
 */
export function injectSetDataPickInJs(
  source: string,
  pickKeys: string[],
): { code: string, transformed: boolean, map?: EncodedSourceMapLike | null } {
  const mergedPickKeys = mergeStableKeys(pickKeys, [
    WEVU_SLOT_NAMES_PROP,
    WEVU_SLOT_OWNER_ID_PROP,
    WEVU_SLOT_SCOPE_KEY,
  ])
  if (!mergedPickKeys.length) {
    return { code: source, transformed: false }
  }

  return transformTargetWevuOptionsInJs(
    source,
    optionsObject => injectPickIntoOptionsObject(optionsObject, mergedPickKeys),
  )
}

/**
 * 只为 scoped slot 宿主首屏同步注入必要的 setData.pick 字段。
 */
export function injectScopedSlotOwnerSetDataPickInJs(
  source: string,
  pickKeys: string[] = [],
): { code: string, transformed: boolean, map?: EncodedSourceMapLike | null } {
  const mergedPickKeys = mergeStableKeys(pickKeys, [
    WEVU_SLOT_OWNER_ID_KEY,
    WEVU_SLOT_NAMES_PROP,
    WEVU_SLOT_OWNER_ID_PROP,
    WEVU_SLOT_SCOPE_KEY,
  ])
  return transformTargetWevuOptionsInJs(
    source,
    optionsObject => injectPickIntoOptionsObject(optionsObject, mergedPickKeys),
  )
}

/**
 * 在含有 scoped slot outlet 的 wevu 组件脚本中注入宿主内部属性。
 */
export function injectScopedSlotHostPropertiesInJs(
  source: string,
): { code: string, transformed: boolean, map?: EncodedSourceMapLike | null } {
  return transformTargetWevuOptionsInJs(
    source,
    injectScopedSlotHostPropertiesIntoOptionsObject,
  )
}
