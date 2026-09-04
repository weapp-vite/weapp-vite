/**
 * 页面布局属性可序列化值。
 */
export type CompilerLayoutPropValue
  = | string
    | number
    | boolean
    | null
    | {
      kind: 'expression'
      expression: string
    }

/**
 * 编译阶段需要的单个页面布局描述。
 */
export interface CompilerPageLayout {
  importPath: string
  layoutName: string
  tagName: string
  props?: Record<string, CompilerLayoutPropValue>
}

/**
 * 构建工具解析后传给编译器的页面布局计划。
 */
export interface CompilerPageLayoutPlan {
  currentLayout?: CompilerPageLayout
  dynamicSwitch: boolean
  layouts: CompilerPageLayout[]
  dynamicPropKeys: string[]
}

/**
 * 构建工具解析后传给编译器的应用外壳描述。
 */
export interface CompilerAppShell {
  importPath: string
  tagName: string
}
