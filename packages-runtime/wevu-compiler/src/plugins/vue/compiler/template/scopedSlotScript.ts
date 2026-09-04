import type { WevuRuntimeCapabilityMetadata } from '../../../../runtimeCapabilities'
import type { WevuBindingManifestV1, WevuRuntimeBindingManifestMode } from '../../../../types/bindingManifest'
import type { ClassStyleBinding, InlineExpressionAsset, LayoutHostBinding, TemplateRefBinding } from './types'
import { WEVU_BINDING_MANIFEST_KEY, WEVU_LAYOUT_HOSTS_KEY, WEVU_SCOPED_SLOT_CREATOR_KEY } from '@weapp-core/constants'
import { createRuntimeBindingManifest } from '../../../../bindingManifest'
import {
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
  WE_VU_COMPILER_TEMPLATE_MODULE_ID,
  WE_VU_RUNTIME_APIS,
} from '../../../../constants'
import {
  WE_VU_RUNTIME_CAPABILITY_INSTALLERS,
  WE_VU_RUNTIME_CAPABILITY_ORDER,
} from '../../../../runtimeCapabilities'
import { generate } from '../../../../utils/babel'
import { buildClassStyleComputedCode } from '../../transform/classStyleComputed'

function buildInlineExpressionMapCode(inlineExpressions: InlineExpressionAsset[]) {
  if (!inlineExpressions.length) {
    return null
  }
  const entries = inlineExpressions.map((entry) => {
    const keys = JSON.stringify(entry.scopeKeys)
    return `${JSON.stringify(entry.id)}:{keys:${keys},fn:(ctx,scope,$event)=>${entry.expression}}`
  })
  return `{${entries.join(',')}}`
}

function buildTemplateRefsCode(templateRefs: TemplateRefBinding[]) {
  if (!templateRefs.length) {
    return null
  }
  const entries = templateRefs.map((binding) => {
    const fields = [
      `selector:${JSON.stringify(binding.selector)}`,
      `inFor:${binding.inFor}`,
    ]
    if (binding.name) {
      fields.push(`name:${JSON.stringify(binding.name)}`)
    }
    if (binding.expAst) {
      fields.push(`get:function(){return ${generate(binding.expAst, { compact: true }).code}}`)
    }
    if (binding.kind) {
      fields.push(`kind:${JSON.stringify(binding.kind)}`)
    }
    return `{${fields.join(',')}}`
  })
  return `[${entries.join(',')}]`
}

/**
 * 生成由编译器拥有的作用域插槽组件脚本。
 */
export function buildScopedSlotComponentScript(options: {
  classStyleBindings: ClassStyleBinding[]
  inlineExpressions: InlineExpressionAsset[]
  layoutHosts: LayoutHostBinding[]
  templateRefs: TemplateRefBinding[]
  bindingManifest: WevuBindingManifestV1
  runtimeBindingManifest: WevuRuntimeBindingManifestMode
  runtimeCapabilities?: WevuRuntimeCapabilityMetadata
}) {
  const computedCode = options.classStyleBindings.length
    ? buildClassStyleComputedCode(options.classStyleBindings, {
        normalizeClassName: '__wevuNormalizeClass',
        normalizeStyleName: '__wevuNormalizeStyle',
        unrefName: '__wevuUnref',
      })
    : null
  const inlineMapCode = buildInlineExpressionMapCode(options.inlineExpressions)
  const templateRefsCode = buildTemplateRefsCode(options.templateRefs)
  const layoutHostsCode = options.layoutHosts.length
    ? JSON.stringify(options.layoutHosts)
    : null
  const requiredCapabilitySet = new Set(options.runtimeCapabilities?.required)
  const installerNames = WE_VU_RUNTIME_CAPABILITY_ORDER
    .filter(capability => requiredCapabilitySet.has(capability))
    .map(capability => WE_VU_RUNTIME_CAPABILITY_INSTALLERS[capability])
  const runtimeImports = [
    `${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent`,
    ...installerNames.map(installerName => `${installerName} as _${installerName}`),
  ]
  const lines = [
    `import { ${runtimeImports.join(', ')} } from '${WE_VU_COMPILER_RUNTIME_MODULE_ID}';`,
  ]
  if (computedCode) {
    lines.push(`import { normalizeClass as __wevuNormalizeClass, normalizeStyle as __wevuNormalizeStyle } from '${WE_VU_COMPILER_TEMPLATE_MODULE_ID}';`)
  }
  if (computedCode || templateRefsCode) {
    lines.push(`import { unref as __wevuUnref } from '${WE_VU_COMPILER_REACTIVITY_MODULE_ID}';`)
  }
  lines.push(...installerNames.map(installerName => `_${installerName}();`))
  lines.push(
    'const globalObject = typeof globalThis !== \'undefined\' ? globalThis : undefined;',
    `const createWevuScopedSlotComponent = globalObject?.${WEVU_SCOPED_SLOT_CREATOR_KEY}`,
    '  ?? _createWevuScopedSlotComponent;',
  )
  if (computedCode) {
    lines.push(`const __wevuComputed = ${computedCode};`)
  }
  if (inlineMapCode) {
    lines.push(`const __wevuInlineMap = ${inlineMapCode};`)
  }
  if (templateRefsCode) {
    lines.push(`const __wevuTemplateRefs = ${templateRefsCode};`)
  }
  if (layoutHostsCode) {
    lines.push(`const __wevuLayoutHosts = ${layoutHostsCode};`)
  }
  const overrideParts = [
    `${JSON.stringify(WEVU_BINDING_MANIFEST_KEY)}:Object.freeze(${JSON.stringify(createRuntimeBindingManifest(options.bindingManifest, options.runtimeBindingManifest))})`,
  ]
  if (computedCode) {
    overrideParts.push('computed:__wevuComputed')
  }
  if (layoutHostsCode) {
    overrideParts.push(`${JSON.stringify(WEVU_LAYOUT_HOSTS_KEY)}:__wevuLayoutHosts`)
  }
  if (inlineMapCode) {
    overrideParts.push('inlineMap:__wevuInlineMap')
  }
  if (templateRefsCode) {
    overrideParts.push('templateRefs:__wevuTemplateRefs')
  }
  lines.push(
    'if (typeof createWevuScopedSlotComponent === \'function\') {',
    `  createWevuScopedSlotComponent({${overrideParts.join(',')}});`,
    '}',
    '',
  )
  return lines.join('\n')
}
