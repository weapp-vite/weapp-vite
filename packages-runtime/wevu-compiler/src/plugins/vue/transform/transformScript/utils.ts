import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { WevuDefaults } from '../../../../types/wevu'
import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import type { ClassStyleBinding, ClassStyleRuntime, InlineExpressionAsset, LayoutHostBinding, TemplateRefBinding } from '../../compiler/template/types'
import * as t from '@weapp-vite/ast/babelTypes'

/**
 * 使用 Babel AST 转换脚本
 * 比正则替换更健壮，能处理复杂的代码结构
 */
export interface TransformResult {
  code: string
  transformed: boolean
  map?: EncodedSourceMapLike | null
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
   * <script setup> 中仅由模板使用的导入组件：编译时移除 import 与 Vue 编译器自动返回的 getter。
   * key: 组件别名（需与模板标签一致），value: usingComponents 的 from（如 `/components/foo/index`）
   */
  templateComponentMeta?: Record<string, string>
  /**
   * wevu 默认值（仅用于 app.vue 注入）
   */
  wevuDefaults?: WevuDefaults
  /**
   * 是否压缩生成的脚本代码。
   */
  minify?: boolean
  /**
   * 是否生成脚本 sourcemap。
   */
  sourceMap?: boolean
  /**
   * 编译期警告回调
   */
  warn?: (message: string) => void
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
  /**
   * layout host 元数据（用于运行时绑定）
   */
  layoutHosts?: LayoutHostBinding[]
  /**
   * 内联表达式元数据（用于事件处理）
   */
  inlineExpressions?: InlineExpressionAsset[]
  /**
   * 模板中作为组件 prop 传递的函数候选路径。
   */
  functionPropPaths?: string[]
  /**
   * Vue `<script setup>` props 解构重命名映射，key 为模板中使用的本地别名，value 为原始 prop 名。
   */
  propsAliases?: Record<string, string>
  /**
   * Vue `<script setup>` 中直接来自 props 的绑定名，用于运行时区分 props-derived binding 与普通 setup state。
   */
  propsDerivedKeys?: string[]
  /**
   * 对 `<script setup>` 类型声明生成的结构化 props（如 Array/Object）放宽小程序运行时类型约束，
   * 以避免小程序属性校验对复杂表达式/代理值产生误报。
   */
  relaxStructuredTypeOnlyProps?: boolean
  /**
   * 当前组件模板包含 scoped slot outlet，需要接收 scoped slot 桥接属性。
   */
  scopedSlotHostProperties?: boolean
}

export interface TransformState {
  transformed: boolean
  defineComponentAliases: Set<string>
  defineComponentDecls: Map<string, t.ObjectExpression>
  defaultExportPath: NodePath<t.ExportDefaultDeclaration> | null
}

export const PAGE_META_MACRO_NAME = 'definePageMeta'

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
