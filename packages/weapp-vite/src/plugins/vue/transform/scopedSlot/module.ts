import type { InlineExpressionAsset } from 'wevu/compiler'
import { buildClassStyleComputedCode, getClassStyleWxsSource, WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
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

function buildScopedSlotComponentModule(options?: { computedCode?: string, inlineMapCode?: string }): string {
  const computedCode = options?.computedCode
  const inlineMapCode = options?.inlineMapCode
  const importSpecifiers = computedCode
    ? `${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent, normalizeClass as __wevuNormalizeClass, normalizeStyle as __wevuNormalizeStyle, unref as __wevuUnref`
    : `${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent`

  const lines = [
    `import { ${importSpecifiers} } from '${WE_VU_MODULE_ID}';`,
    'const globalObject = typeof globalThis !== \'undefined\' ? globalThis : undefined;',
    'const createWevuScopedSlotComponent = globalObject?.__weapp_vite_createScopedSlotComponent',
    '  ?? _createWevuScopedSlotComponent;',
  ]

  if (computedCode) {
    lines.push(`const __wevuComputed = ${computedCode};`)
  }
  if (inlineMapCode) {
    lines.push(`const __wevuInlineMap = ${inlineMapCode};`)
  }
  const overrideParts: string[] = []
  if (computedCode) {
    overrideParts.push('computed: __wevuComputed')
  }
  if (inlineMapCode) {
    overrideParts.push('inlineMap: __wevuInlineMap')
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
      scopedSlotModules.set(
        virtualId,
        buildScopedSlotComponentModule(
          computedCode || inlineMapCode ? { computedCode: computedCode ?? undefined, inlineMapCode: inlineMapCode ?? undefined } : undefined,
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
