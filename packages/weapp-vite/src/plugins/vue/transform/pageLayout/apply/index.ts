import type { MpPlatform } from '../../../../../types'
import type { LayoutTransformLikeResult, ResolvedPageLayout, ResolvedPageLayoutPlan } from '../types'
import { WEVU_PAGE_LAYOUT_NAME_KEY } from '@weapp-core/constants'
import { getPlatformLayoutConditionalDirective, getPlatformLayoutElseDirective } from '../shared'
import { buildDynamicLayoutTemplate, collapseNestedLayoutWrapper, hasDynamicExpressionLayoutProps, serializeLayoutProps } from '../template'
import { mergeLayoutUsingComponents, mergeSingleLayoutUsingComponent } from './config'

function hasDynamicLayoutTemplateWrapper(
  template: string,
  plan: ResolvedPageLayoutPlan,
  platform?: MpPlatform,
) {
  const firstDirective = getPlatformLayoutConditionalDirective(0, platform)
  if (!plan.layouts.length || !template.startsWith(`<block ${firstDirective}=`)) {
    return false
  }

  return plan.layouts.every((layout, index) => {
    const condition = plan.currentLayout?.layoutName === layout.layoutName
      ? `{{!${WEVU_PAGE_LAYOUT_NAME_KEY} || ${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
      : `{{${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
    const directive = getPlatformLayoutConditionalDirective(index, platform)

    return template.includes(`<block ${directive}=\"${condition}\"><${layout.tagName}`)
  }) && template.includes(`<block ${getPlatformLayoutElseDirective(platform)}>`)
}

function applySingleNativePageLayout(
  result: LayoutTransformLikeResult,
  layout: ResolvedPageLayout | undefined,
) {
  if (!layout || !result.template) {
    return result
  }

  const serializedProps = serializeLayoutProps(layout.props)
  if (result.template.startsWith(`<${layout.tagName}`)) {
    result.template = collapseNestedLayoutWrapper(result.template, layout.tagName)
  }
  else {
    result.template = `<${layout.tagName}${serializedProps}>${result.template}</${layout.tagName}>`
  }
  result.config = mergeSingleLayoutUsingComponent(result.config, layout)
  return result
}

function applyNativePageLayoutPlan(
  result: LayoutTransformLikeResult,
  plan: ResolvedPageLayoutPlan,
  platform?: MpPlatform,
) {
  if (!result.template) {
    return result
  }

  if (!plan.dynamicSwitch) {
    return applySingleNativePageLayout(result, plan.currentLayout)
  }

  if (!hasDynamicLayoutTemplateWrapper(result.template, plan, platform)) {
    result.template = buildDynamicLayoutTemplate(
      result.template,
      plan.currentLayout,
      plan.layouts,
      plan.dynamicPropKeys,
      platform,
    )
  }
  result.config = mergeLayoutUsingComponents(result.config, plan.layouts)
  return result
}

export function applyPageLayoutPlanToNativePage(
  result: LayoutTransformLikeResult,
  filename: string,
  plan: ResolvedPageLayoutPlan | undefined,
  options?: {
    platform?: MpPlatform
  },
) {
  if (!plan || !result.template) {
    return result
  }

  if (hasDynamicExpressionLayoutProps(plan.currentLayout?.props)) {
    throw new Error(`${filename} 中原生 Page 的 layout.props 暂不支持表达式，请改用静态字面量或在运行时调用 setPageLayout()。`)
  }

  return applyNativePageLayoutPlan(result, plan, options?.platform)
}

export { injectNativePageLayoutRuntime } from './native'
