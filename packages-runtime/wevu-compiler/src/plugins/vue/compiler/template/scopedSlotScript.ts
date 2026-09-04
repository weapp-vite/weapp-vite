import type { WevuBindingManifestV1 } from '../../../../types/bindingManifest'
import type { ClassStyleBinding, InlineExpressionAsset, TemplateRefBinding } from './types'
import { WEVU_BINDING_MANIFEST_KEY, WEVU_SCOPED_SLOT_CREATOR_KEY } from '@weapp-core/constants'
import {
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
  WE_VU_COMPILER_TEMPLATE_MODULE_ID,
  WE_VU_RUNTIME_APIS,
} from '../../../../constants'
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
  templateRefs: TemplateRefBinding[]
  bindingManifest: WevuBindingManifestV1
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
  const lines = [
    `import { ${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent } from '${WE_VU_COMPILER_RUNTIME_MODULE_ID}';`,
  ]
  if (computedCode) {
    lines.push(`import { normalizeClass as __wevuNormalizeClass, normalizeStyle as __wevuNormalizeStyle } from '${WE_VU_COMPILER_TEMPLATE_MODULE_ID}';`)
  }
  if (computedCode || templateRefsCode) {
    lines.push(`import { unref as __wevuUnref } from '${WE_VU_COMPILER_REACTIVITY_MODULE_ID}';`)
  }
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
  const overrideParts = [
    `${JSON.stringify(WEVU_BINDING_MANIFEST_KEY)}:Object.freeze(${JSON.stringify(options.bindingManifest)})`,
  ]
  if (computedCode) {
    overrideParts.push('computed:__wevuComputed')
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
