import type { CompilerContext } from '../../../../context'
import type { OutputExtensions } from '../../../../platforms/types'
import type { VueTransformResult } from '../compileVueFile'
import { WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { toPosixPath } from '../../../../utils/path'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { getClassStyleWxsSource } from '../../compiler/template/classStyleRuntime'
import { buildClassStyleComputedCode } from '../classStyleComputed'
import { emitClassStyleWxsAssetIfMissing } from '../vitePlugin/emitAssets'

interface ClassStyleWxsAsset {
  fileName: string
  source: string
}

const SCOPED_SLOT_VIRTUAL_PREFIX = '\0weapp-vite:scoped-slot:'

function buildScopedSlotComponentModule(options?: { computedCode?: string }): string {
  const computedCode = options?.computedCode
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
    lines.push('if (typeof createWevuScopedSlotComponent === \'function\') {')
    lines.push('  createWevuScopedSlotComponent({ computed: __wevuComputed });')
    lines.push('}')
  }
  else {
    lines.push('if (typeof createWevuScopedSlotComponent === \'function\') {')
    lines.push('  createWevuScopedSlotComponent();')
    lines.push('}')
  }

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

function resolveScopedSlotAutoImports(
  compilerCtx: Pick<CompilerContext, 'autoImportService' | 'wxmlService'> | undefined,
  baseUsingComponents: Record<string, string>,
  componentBase: string,
  template: string,
): Record<string, string> {
  const usingComponents: Record<string, string> = { ...baseUsingComponents }
  const autoImportService = compilerCtx?.autoImportService
  const wxmlService = compilerCtx?.wxmlService
  if (!autoImportService || !wxmlService) {
    return usingComponents
  }

  try {
    const token = wxmlService.analyze(template)
    const depComponentNames = Object.keys(token.components ?? {})
    for (const depComponentName of depComponentNames) {
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
    // 忽略异常，回退到 baseUsingComponents
  }

  return usingComponents
}

export function emitScopedSlotAssets(
  ctx: { emitFile: (asset: { type: 'asset', fileName: string, source: string }) => void },
  bundle: Record<string, any>,
  relativeBase: string,
  result: VueTransformResult,
  compilerCtx?: Pick<CompilerContext, 'autoImportService' | 'wxmlService'>,
  classStyleWxs?: ClassStyleWxsAsset,
  outputExtensions?: OutputExtensions,
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
      const json = {
        component: true,
        usingComponents: scopedUsingComponents,
      }
      ctx.emitFile({ type: 'asset', fileName: jsonFile, source: JSON.stringify(json, null, 2) })
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
  result.config = JSON.stringify(configObj, null, 2)
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
      scopedSlotModules.set(
        virtualId,
        buildScopedSlotComponentModule(
          computedCode ? { computedCode } : undefined,
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
