import type { NodePath } from '@babel/traverse'
import type { WevuDefaults } from 'wevu'
import type { ClassStyleBinding, ClassStyleRuntime, TemplateRefBinding } from '../../compiler/template/types'
import * as t from '@babel/types'

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
  /**
   * class/style 运行时模式
   */
  classStyleRuntime?: ClassStyleRuntime
  /**
   * class/style 绑定元数据（JS 运行时）
   */
  classStyleBindings?: ClassStyleBinding[]
  /**
   * template ref 元数据（用于运行时绑定）
   */
  templateRefs?: TemplateRefBinding[]
}

export interface TransformState {
  transformed: boolean
  defineComponentAliases: Set<string>
  defineComponentDecls: Map<string, t.ObjectExpression>
  defaultExportPath: NodePath<t.ExportDefaultDeclaration> | null
}

export function isPlainRecord(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function isStaticObjectKeyMatch(key: t.Expression | t.PrivateName, expected: string) {
  if (t.isIdentifier(key)) {
    return key.name === expected
  }
  if (t.isStringLiteral(key)) {
    return key.value === expected
  }
  return false
}

export function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
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

export function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}
