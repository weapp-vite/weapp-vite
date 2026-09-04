import type { VueTransformResult } from 'wevu/compiler'
import type { OutputExtensions } from '../../../../platforms/types'
import { getClassStyleWxsSource } from 'wevu/compiler'
import { resolveCompilerOutputExtensions } from '../../../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'

const SCOPED_SLOT_VIRTUAL_PREFIX = '\0weapp-vite:scoped-slot:'

function getScopedSlotVirtualId(componentBase: string): string {
  return `${SCOPED_SLOT_VIRTUAL_PREFIX}${componentBase}`
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

  const { scriptExtension } = resolveCompilerOutputExtensions(outputExtensions)
  for (const scopedSlot of scopedSlots) {
    const componentBase = `${relativeBase}.__scoped-slot-${scopedSlot.id}`
    const jsFile = `${componentBase}.${scriptExtension}`
    const virtualId = getScopedSlotVirtualId(componentBase)
    scopedSlotModules.set(virtualId, scopedSlot.script)
    if (emittedScopedSlotChunks.has(jsFile)) {
      continue
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
