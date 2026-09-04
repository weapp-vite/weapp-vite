import type { WevuBindingManifestV1 } from '../../../../types/bindingManifest'
import type { CompilerAppShell, CompilerLayoutPropValue, CompilerPageLayout, CompilerPageLayoutPlan } from '../../../../types/pageLayout'
import type { MiniProgramPlatform } from '../../compiler/template'
import {
  WEVU_LAYOUT_BIND_PREFIX,
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
} from '@weapp-core/constants'
import { escapeWxmlAttribute } from '@weapp-core/shared'
import { recordSyntheticBindingExpression } from '../../compiler/template/bindingManifest'

const LAYOUT_OWNER_EXPRESSION = `${WEVU_SLOT_OWNER_ID_PROP} || ${WEVU_SLOT_OWNER_ID_KEY} || ''`
const LAYOUT_SLOT_OWNER_ATTR = `${WEVU_SLOT_OWNER_ID_ATTR}="{{${LAYOUT_OWNER_EXPRESSION}}}"`
const CAMEL_TO_KEBAB_RE = /([a-z0-9])([A-Z])/g
const LAYOUT_NAME_SEPARATORS_RE = /[_\s]+/g
const DUPLICATE_DASH_RE = /-+/g
const EDGE_DASH_RE = /^-|-$/g

function toKebabCase(value: string) {
  return value
    .replace(CAMEL_TO_KEBAB_RE, '$1-$2')
    .replace(LAYOUT_NAME_SEPARATORS_RE, '-')
    .replace(DUPLICATE_DASH_RE, '-')
    .replace(EDGE_DASH_RE, '')
    .toLowerCase()
}

function serializeLayoutProps(props: Record<string, CompilerLayoutPropValue> | undefined) {
  const attrs = [LAYOUT_SLOT_OWNER_ATTR]
  for (const [key, value] of Object.entries(props ?? {})) {
    const attrName = toKebabCase(key)
    if (typeof value === 'string') {
      attrs.push(`${attrName}="${escapeWxmlAttribute(value)}"`)
    }
    else if (typeof value === 'object' && value && value.kind === 'expression') {
      attrs.push(`${attrName}="{{${WEVU_LAYOUT_BIND_PREFIX}${key}}}"`)
    }
    else {
      attrs.push(`${attrName}="{{${String(value)}}}"`)
    }
  }
  return ` ${attrs.join(' ')}`
}

function serializeFallbackLayoutValue(value: CompilerLayoutPropValue | undefined, key: string) {
  const runtimeValue = `${WEVU_PAGE_LAYOUT_PROPS_KEY}&&${WEVU_PAGE_LAYOUT_PROPS_KEY}.${key}`
  if (value === undefined) {
    return `(${runtimeValue})`
  }
  const fallback = typeof value === 'object' && value?.kind === 'expression'
    ? `${WEVU_LAYOUT_BIND_PREFIX}${key}`
    : JSON.stringify(value)
  return `(${runtimeValue})!==undefined?${WEVU_PAGE_LAYOUT_PROPS_KEY}.${key}:${fallback}`
}

function buildDynamicLayoutTemplate(
  template: string,
  currentLayout: CompilerPageLayout | undefined,
  layouts: CompilerPageLayout[],
  propKeys: string[],
  platform: MiniProgramPlatform,
) {
  const blocks = layouts.map((layout, index) => {
    const attrs = [LAYOUT_SLOT_OWNER_ATTR]
    for (const key of propKeys) {
      attrs.push(`${toKebabCase(key)}="{{${serializeFallbackLayoutValue(currentLayout?.props?.[key], key)}}}"`)
    }
    const condition = currentLayout?.layoutName === layout.layoutName
      ? `{{!${WEVU_PAGE_LAYOUT_NAME_KEY} || ${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
      : `{{${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
    const directive = index === 0 ? platform.directives.ifAttr : platform.directives.elifAttr
    return `<block ${directive}="${condition}"><${layout.tagName} ${attrs.join(' ')}>${template}</${layout.tagName}></block>`
  })
  return `${blocks.join('')}<block ${platform.directives.elseAttr}>${template}</block>`
}

function hasDynamicLayoutWrapper(
  template: string,
  plan: CompilerPageLayoutPlan,
  platform: MiniProgramPlatform,
) {
  if (!plan.layouts.length || !template.startsWith(`<block ${platform.directives.ifAttr}=`)) {
    return false
  }
  return plan.layouts.every((layout, index) => {
    const condition = plan.currentLayout?.layoutName === layout.layoutName
      ? `{{!${WEVU_PAGE_LAYOUT_NAME_KEY} || ${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
      : `{{${WEVU_PAGE_LAYOUT_NAME_KEY} === '${layout.layoutName}'}}`
    const directive = index === 0 ? platform.directives.ifAttr : platform.directives.elifAttr
    return template.includes(`<block ${directive}="${condition}"><${layout.tagName}`)
  }) && template.includes(`<block ${platform.directives.elseAttr}>`)
}

function recordLayoutBindings(manifest: WevuBindingManifestV1, plan: CompilerPageLayoutPlan) {
  manifest.features.layout = true
  recordSyntheticBindingExpression(manifest, {
    kind: 'attribute',
    expression: LAYOUT_OWNER_EXPRESSION,
  })
  if (plan.dynamicSwitch) {
    recordSyntheticBindingExpression(manifest, {
      kind: 'if',
      expression: WEVU_PAGE_LAYOUT_NAME_KEY,
    })
    if (plan.dynamicPropKeys.length) {
      recordSyntheticBindingExpression(manifest, {
        kind: 'component-prop',
        expression: WEVU_PAGE_LAYOUT_PROPS_KEY,
      })
    }
  }
  for (const [key, value] of Object.entries(plan.currentLayout?.props ?? {})) {
    if (typeof value !== 'object' || !value || value.kind !== 'expression') {
      continue
    }
    recordSyntheticBindingExpression(manifest, {
      kind: 'component-prop',
      expression: value.expression,
      outputPath: `${WEVU_LAYOUT_BIND_PREFIX}${key}`,
    })
  }
}

function collapseNestedWrapper(template: string, tagName: string) {
  const closeTag = `</${tagName}>`
  let next = template
  while (next.startsWith(`<${tagName}`) && next.endsWith(closeTag)) {
    const openTagEnd = next.indexOf('>')
    if (openTagEnd < 0) {
      break
    }
    const inner = next.slice(openTagEnd + 1, -closeTag.length)
    if (!inner.startsWith(`<${tagName}`)) {
      break
    }
    next = inner
  }
  return next
}

function unwrapOuterWrapper(template: string, tagName: string) {
  const closeTag = `</${tagName}>`
  if (!template.startsWith(`<${tagName}`) || !template.endsWith(closeTag)) {
    return undefined
  }
  const openTagEnd = template.indexOf('>')
  if (openTagEnd < 0) {
    return undefined
  }
  return {
    openTag: template.slice(0, openTagEnd + 1),
    content: template.slice(openTagEnd + 1, -closeTag.length),
  }
}

function recordAppShellBinding(manifest: WevuBindingManifestV1) {
  recordSyntheticBindingExpression(manifest, {
    kind: 'attribute',
    expression: LAYOUT_OWNER_EXPRESSION,
  })
}

/**
 * 在脚本转换前应用页面布局和应用外壳，并同步记录合成绑定。
 */
export function applyCompilerTemplateWrappers(options: {
  template: string
  manifest: WevuBindingManifestV1
  platform: MiniProgramPlatform
  pageLayout?: CompilerPageLayoutPlan
  appShell?: CompilerAppShell
}) {
  const { manifest, platform, pageLayout, appShell } = options
  let template = options.template
  let existingAppShellOpenTag: string | undefined
  if (appShell) {
    const normalized = collapseNestedWrapper(template, appShell.tagName)
    const existingAppShell = unwrapOuterWrapper(normalized, appShell.tagName)
    if (existingAppShell) {
      existingAppShellOpenTag = existingAppShell.openTag
      template = existingAppShell.content
    }
  }
  if (pageLayout) {
    recordLayoutBindings(manifest, pageLayout)
    if (pageLayout.dynamicSwitch) {
      if (!hasDynamicLayoutWrapper(template, pageLayout, platform)) {
        template = buildDynamicLayoutTemplate(
          template,
          pageLayout.currentLayout,
          pageLayout.layouts,
          pageLayout.dynamicPropKeys,
          platform,
        )
      }
    }
    else if (pageLayout.currentLayout) {
      const layout = pageLayout.currentLayout
      template = template.startsWith(`<${layout.tagName}`)
        ? collapseNestedWrapper(template, layout.tagName)
        : `<${layout.tagName}${serializeLayoutProps(layout.props)}>${template}</${layout.tagName}>`
    }
  }
  if (appShell) {
    recordAppShellBinding(manifest)
    const openTag = existingAppShellOpenTag
      ?? `<${appShell.tagName} ${LAYOUT_SLOT_OWNER_ATTR}>`
    template = `${openTag}${template}</${appShell.tagName}>`
  }
  return template
}

/**
 * 把编译器拥有的布局组件注册合并到页面配置。
 */
export function mergeCompilerLayoutUsingComponents(
  config: string | undefined,
  pageLayout?: CompilerPageLayoutPlan,
  appShell?: CompilerAppShell,
) {
  if (!pageLayout && !appShell) {
    return config
  }
  const parsed = config ? JSON.parse(config) : {}
  const usingComponents = parsed.usingComponents && typeof parsed.usingComponents === 'object' && !Array.isArray(parsed.usingComponents)
    ? parsed.usingComponents
    : {}
  for (const layout of pageLayout?.layouts ?? []) {
    usingComponents[layout.tagName] = layout.importPath
  }
  if (!pageLayout?.dynamicSwitch && pageLayout?.currentLayout) {
    usingComponents[pageLayout.currentLayout.tagName] = pageLayout.currentLayout.importPath
  }
  if (appShell) {
    usingComponents[appShell.tagName] = appShell.importPath
  }
  parsed.usingComponents = usingComponents
  return JSON.stringify(parsed, null, 2)
}
