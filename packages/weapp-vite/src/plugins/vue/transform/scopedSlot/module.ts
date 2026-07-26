import type { InlineExpressionAsset, TemplateRefBinding } from 'wevu/compiler'
import { WEVU_SCOPED_SLOT_CREATOR_KEY } from '@weapp-core/constants'
import { generate } from '@weapp-vite/ast'
import { buildClassStyleComputedCode, getClassStyleWxsSource, WE_VU_COMPILER_REACTIVITY_MODULE_ID, WE_VU_COMPILER_RUNTIME_MODULE_ID, WE_VU_COMPILER_TEMPLATE_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { resolveCompilerOutputExtensions } from '../../../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'

const SCOPED_SLOT_VIRTUAL_PREFIX = '\0weapp-vite:scoped-slot:'

function buildInlineExpressionMapCode(inlineExpressions?: InlineExpressionAsset[]): string | null {
  if (!inlineExpressions?.length) {
    return null
  }
  const entries = inlineExpressions.map((entry) => {
    const keys = JSON.stringify(entry.scopeKeys)
    return `${JSON.stringify(entry.id)}:{keys:${keys},fn:(ctx,scope,$event)=>${entry.expression}}`
  })
  return `{${entries.join(',')}}`
}

function buildTemplateRefsCode(templateRefs?: TemplateRefBinding[]): string | null {
  if (!templateRefs?.length) {
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

function buildScopedSlotComponentModule(options?: {
  computedCode?: string
  inlineMapCode?: string
  templateRefsCode?: string
}): string {
  const computedCode = options?.computedCode
  const inlineMapCode = options?.inlineMapCode
  const templateRefsCode = options?.templateRefsCode
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
  const overrideParts: string[] = []
  if (computedCode) {
    overrideParts.push('computed: __wevuComputed')
  }
  if (inlineMapCode) {
    overrideParts.push('inlineMap: __wevuInlineMap')
  }
  if (templateRefsCode) {
    overrideParts.push('templateRefs: __wevuTemplateRefs')
  }
  const overrideArg = overrideParts.length ? `{ ${overrideParts.join(', ')} }` : ''
  lines.push('if (typeof createWevuScopedSlotComponent === \'function\') {')
  if (overrideArg) {
    lines.push(`  createWevuScopedSlotComponent(${overrideArg});`)
  }
  else {
    lines.push('  createWevuScopedSlotComponent();')
  }
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function getScopedSlotVirtualId(componentBase: string): string {
  return `${SCOPED_SLOT_VIRTUAL_PREFIX}${componentBase}`
}

export function emitScopedSlotChunks(
  ctx: { emitFile: (asset: { type: 'chunk', id: string, fileName: string }) => void },
  relativeBase: string,
  result: import('wevu/compiler').VueTransformResult,
  scopedSlotModules: Map<string, string>,
  emittedScopedSlotChunks: Set<string>,
  outputExtensions?: import('../../../../platforms/types').OutputExtensions,
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  const { scriptExtension } = resolveCompilerOutputExtensions(outputExtensions)
  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const jsFile = `${componentBase}.${scriptExtension}`
    if (emittedScopedSlotChunks.has(jsFile)) {
      continue
    }

    const virtualId = getScopedSlotVirtualId(componentBase)
    if (!scopedSlotModules.has(virtualId)) {
      const computedCode = scopedSlot.classStyleBindings?.length
        ? buildClassStyleComputedCode(scopedSlot.classStyleBindings, {
            normalizeClassName: '__wevuNormalizeClass',
            normalizeStyleName: '__wevuNormalizeStyle',
            unrefName: '__wevuUnref',
          })
        : null
      const inlineMapCode = buildInlineExpressionMapCode(scopedSlot.inlineExpressions)
      const templateRefsCode = buildTemplateRefsCode(scopedSlot.templateRefs)
      scopedSlotModules.set(
        virtualId,
        buildScopedSlotComponentModule(
          computedCode || inlineMapCode || templateRefsCode
            ? {
                computedCode: computedCode ?? undefined,
                inlineMapCode: inlineMapCode ?? undefined,
                templateRefsCode: templateRefsCode ?? undefined,
              }
            : undefined,
        ),
      )
    }

    ctx.emitFile({
      type: 'chunk',
      id: virtualId,
      fileName: jsFile,
      // @ts-ignore
      preserveSignature: 'exports-only',
    })
    emittedScopedSlotChunks.add(jsFile)
  }
}

export function resolveScopedSlotVirtualId(id: string) {
  if (!id.startsWith(SCOPED_SLOT_VIRTUAL_PREFIX)) {
    return null
  }
  return id
}

export function loadScopedSlotModule(id: string, scopedSlotModules: Map<string, string>) {
  if (!id.startsWith(SCOPED_SLOT_VIRTUAL_PREFIX)) {
    return null
  }
  const code = scopedSlotModules.get(id)
  if (!code) {
    return null
  }
  return { code, map: null }
}

export function shouldResetScopedSlotCache(id: string) {
  return normalizeFsResolvedId(id).endsWith('.vue')
}

export function getScopedSlotClassStyleWxs() {
  return getClassStyleWxsSource()
}

export function isScopedSlotVirtualId(id: string) {
  return id.startsWith(SCOPED_SLOT_VIRTUAL_PREFIX)
}
