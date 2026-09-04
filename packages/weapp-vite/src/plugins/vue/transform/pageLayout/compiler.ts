import type { CompilerPageLayout, CompilerPageLayoutPlan } from 'wevu/compiler'
import type { ResolvedPageLayout, ResolvedPageLayoutPlan } from './types'

function sortLayoutProps(layout: ResolvedPageLayout): CompilerPageLayout['props'] {
  if (!layout.props) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(layout.props).sort(([left], [right]) => left.localeCompare(right)),
  )
}

function toCompilerPageLayout(layout: ResolvedPageLayout): CompilerPageLayout {
  return {
    importPath: layout.importPath,
    layoutName: layout.layoutName,
    tagName: layout.tagName,
    props: sortLayoutProps(layout),
  }
}

/**
 * 将包含文件系统信息的布局计划投影为编译器可序列化输入。
 */
export function toCompilerPageLayoutPlan(
  plan: ResolvedPageLayoutPlan | undefined,
): CompilerPageLayoutPlan | undefined {
  if (!plan) {
    return undefined
  }

  return {
    currentLayout: plan.currentLayout
      ? toCompilerPageLayout(plan.currentLayout)
      : undefined,
    dynamicSwitch: plan.dynamicSwitch,
    layouts: plan.layouts.map(toCompilerPageLayout),
    dynamicPropKeys: [...new Set(plan.dynamicPropKeys)].sort(),
  }
}

/**
 * 生成布局编译输入的稳定语义签名，用于隔离编译选项缓存。
 */
export function createCompilerPageLayoutPlanSignature(
  plan: ResolvedPageLayoutPlan | undefined,
): string {
  return JSON.stringify(toCompilerPageLayoutPlan(plan) ?? null)
}
