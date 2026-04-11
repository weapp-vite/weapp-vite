import type { VueTransformResult } from 'wevu/compiler'
import type { LayoutTransformLikeResult, ResolvedPageLayout, ResolvedPageLayoutPlan } from '../types'
import { WEVU_PAGE_LAYOUT_NAME_KEY } from '@weapp-core/constants'
import { getLayoutConditionalDirective, getLayoutElseDirective } from '../shared'
import { buildDynamicLayoutTemplate, collapseNestedLayoutWrapper, hasDynamicExpressionLayoutProps, serializeLayoutProps } from '../template'
import { mergeLayoutUsingComponents, mergeSingleLayoutUsingComponent } from './config'
import { injectLayoutBindingComputed } from './script'

function hasDynamicLayoutTemplateWrapper(
  template: string,
  plan: ResolvedPageLayoutPlan,
) {
  const firstDirective = getLayoutConditionalDirective(0)
  if (!plan.layouts.length || !template.startsWith(`<block ${firstDirective}=`)) {
    return false
  }

  return plan.layouts.every((layout, index) => {
    const condition = plan.currentLayout?.layoutName === layout.layoutName
      ? `{{!${WEVU_PAGE_LAYOUT_NAME_KEY} || ${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
      : `{{${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
    const directive = getLayoutConditionalDirective(index)

    return template.includes(`<block ${directive}="${condition}"><${layout.tagName}`)
  }) && template.includes(`<block ${getLayoutElseDirective()}>`)
}

export function applyPageLayout(
  result: VueTransformResult,
  _filename: string,
  layout: ResolvedPageLayout | undefined,
) {
  if (!layout || !result.template) {
    return result
  }

  const serializedProps = serializeLayoutProps(layout.props)
  if (result.template.startsWith(`<${layout.tagName}`)) {
    result.template = collapseNestedLayoutWrapper(result.template, layout.tagName)
    result.script = injectLayoutBindingComputed(result.script, layout.props)
    result.config = mergeSingleLayoutUsingComponent(result.config, layout)
    return result
  }
  result.template = `<${layout.tagName}${serializedProps}>${result.template}</${layout.tagName}>`
  result.script = injectLayoutBindingComputed(result.script, layout.props)
  result.config = mergeSingleLayoutUsingComponent(result.config, layout)

  return result
}

export function applyPageLayoutPlan(
  result: VueTransformResult,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
) {
  if (!plan || !result.template) {
    return result
  }

  if (!plan.dynamicSwitch) {
    return applyPageLayout(result, filename, plan.currentLayout)
  }

  if (hasDynamicLayoutTemplateWrapper(result.template, plan)) {
    result.script = injectLayoutBindingComputed(result.script, plan.currentLayout?.props)
    result.config = mergeLayoutUsingComponents(result.config, plan.layouts)
    return result
  }

  result.template = buildDynamicLayoutTemplate(result.template, plan.currentLayout, plan.layouts, plan.dynamicPropKeys)
  result.script = injectLayoutBindingComputed(result.script, plan.currentLayout?.props)
  result.config = mergeLayoutUsingComponents(result.config, plan.layouts)
  return result
}

export function applyPageLayoutPlanToNativePage(
  result: LayoutTransformLikeResult,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
) {
  if (!plan || !result.template) {
    return result
  }

  if (hasDynamicExpressionLayoutProps(plan.currentLayout?.props)) {
    throw new Error(`${filename} 中原生 Page 的 layout.props 暂不支持表达式，请改用静态字面量或在运行时调用 setPageLayout()。`)
  }

  return applyPageLayoutPlan(result as VueTransformResult, filename, plan)
}

export { injectNativePageLayoutRuntime } from './native'
