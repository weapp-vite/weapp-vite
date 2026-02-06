import type { InlineExpressionAsset, VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { OutputExtensions } from '../../../platforms/types'
import type { JsonMergeStrategy } from '../../../types'
import { buildClassStyleComputedCode, createJsonMerger, getClassStyleWxsSource, WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { resolveJson } from '../../../utils'
import { toPosixPath } from '../../../utils/path'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { emitClassStyleWxsAssetIfMissing } from './emitAssets'

interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

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
    ? `${WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent} as _createWevuScopedSlotComponent, normalizeClass as __wevuNormalizeClass, normalizeStyle as __wevuNormalizeStyle`
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

function parseJsonSafely(source: string | undefined): Record<string, any> | undefined {
  if (!source) {
    return undefined
  }
  try {
    return JSON.parse(source)
  }
  catch {
    return undefined
  }
}

function normalizeJsonConfigForPlatform(
  json: Record<string, any>,
  compilerCtx?: Pick<CompilerContext, 'configService'>,
) {
  const platform = compilerCtx?.configService?.platform
  if (platform !== 'alipay') {
    return json
  }

  try {
    const source = resolveJson(
      { json },
      undefined,
      platform,
      {
        dependencies: compilerCtx.configService.packageJson?.dependencies,
        alipayNpmMode: compilerCtx.configService.weappViteConfig?.npm?.alipayNpmMode,
      },
    )
    if (!source) {
      return json
    }

    return JSON.parse(source)
  }
  catch {
    return json
  }
}

function resolveScopedSlotAutoImports(
  compilerCtx: Pick<CompilerContext, 'autoImportService' | 'wxmlService'> | undefined,
  baseUsingComponents: Record<string, string>,
  componentBase: string,
  template: string,
): Record<string, string> {
  const autoImportService = compilerCtx?.autoImportService
  const wxmlService = compilerCtx?.wxmlService
  if (!autoImportService || !wxmlService) {
    return { ...baseUsingComponents }
  }

  const usingComponents: Record<string, string> = {}

  try {
    const token = wxmlService.analyze(template)
    const depComponentNames = Object.keys(token.components ?? {})
    for (const depComponentName of depComponentNames) {
      if (Object.prototype.hasOwnProperty.call(baseUsingComponents, depComponentName)) {
        usingComponents[depComponentName] = baseUsingComponents[depComponentName]
        continue
      }

      const match = autoImportService.resolve(depComponentName, componentBase)
      if (!match) {
        continue
      }
      const { value } = match
      if (Object.prototype.hasOwnProperty.call(usingComponents, value.name)) {
        continue
      }
      usingComponents[value.name] = value.from
    }
  }
  catch {
    return { ...baseUsingComponents }
  }

  return usingComponents
}

export function emitScopedSlotAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  result: VueTransformResult,
  compilerCtx?: Pick<CompilerContext, 'autoImportService' | 'wxmlService' | 'configService'>,
  classStyleWxs?: ClassStyleWxsAsset,
  outputExtensions?: OutputExtensions,
  jsonOptions?: {
    defaults?: Record<string, any>
    mergeStrategy?: JsonMergeStrategy
  },
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  const templateExtension = outputExtensions?.wxml ?? 'wxml'
  const jsonExtension = outputExtensions?.json ?? 'json'
  const configObj = parseJsonSafely(result.config) ?? {}
  const baseUsingComponents: Record<string, string> = (configObj.usingComponents && typeof configObj.usingComponents === 'object' && !Array.isArray(configObj.usingComponents))
    ? { ...configObj.usingComponents }
    : {}
  const usingComponents: Record<string, string> = { ...baseUsingComponents }

  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const componentPath = `/${toPosixPath(componentBase)}`
    usingComponents[scopedSlot.componentName] = componentPath

    const wxmlFile = `${componentBase}.${templateExtension}`
    const jsonFile = `${componentBase}.${jsonExtension}`
    const scopedUsingComponents = resolveScopedSlotAutoImports(
      compilerCtx,
      baseUsingComponents,
      componentBase,
      scopedSlot.template,
    )

    if (!bundle[wxmlFile]) {
      ctx.emitFile({ type: 'asset', fileName: wxmlFile, source: scopedSlot.template })
    }
    if (!bundle[jsonFile]) {
      const mergeJson = createJsonMerger(jsonOptions?.mergeStrategy, {
        filename: jsonFile,
        kind: 'component',
      })
      let json = mergeJson({}, { usingComponents: scopedUsingComponents }, 'auto-using-components')
      if (jsonOptions?.defaults && Object.keys(jsonOptions.defaults).length > 0) {
        json = mergeJson(json, jsonOptions.defaults, 'defaults')
      }
      const defaultConfig = { component: true, styleIsolation: 'apply-shared' }
      json = mergeJson(defaultConfig, json, 'emit')
      if (Object.prototype.hasOwnProperty.call(defaultConfig, 'component')) {
        json.component = true
      }
      const normalizedJson = normalizeJsonConfigForPlatform(json, compilerCtx)
      ctx.emitFile({ type: 'asset', fileName: jsonFile, source: JSON.stringify(normalizedJson, null, 2) })
    }
    if (scopedSlot.classStyleWxs && classStyleWxs) {
      emitClassStyleWxsAssetIfMissing(
        ctx,
        bundle,
        classStyleWxs.fileName,
        classStyleWxs.source,
      )
    }
  }

  configObj.usingComponents = usingComponents
  result.config = JSON.stringify(normalizeJsonConfigForPlatform(configObj, compilerCtx), null, 2)
}

export function emitScopedSlotChunks(
  ctx: { emitFile: (asset: { type: 'chunk', id: string, fileName: string }) => void },
  relativeBase: string,
  result: VueTransformResult,
  scopedSlotModules: Map<string, string>,
  emittedScopedSlotChunks: Set<string>,
  outputExtensions?: OutputExtensions,
) {
  const scopedSlots = result.scopedSlotComponents
  if (!scopedSlots?.length) {
    return
  }

  const scriptExtension = outputExtensions?.js ?? 'js'
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
