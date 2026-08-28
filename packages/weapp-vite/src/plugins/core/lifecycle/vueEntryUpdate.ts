import type { VueSfcBlockChanges, VueSfcHmrSignatures } from 'wevu/compiler'
import type { CorePluginState } from '../helpers'
import { fs } from '@weapp-core/shared/fs'
import { classifyVueSfcBlockChanges, resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { isAppVueFile } from '../../vue/transform/appShell'

export interface VueEntryUpdateInspector {
  getChangedBlocks: () => Promise<VueSfcBlockChanges | undefined>
  isAppShellTopologyUpdate: () => Promise<boolean>
  isJsonOnlyUpdate: () => Promise<boolean>
  isLocalAssetOnlyUpdate: () => Promise<boolean>
  isStyleOnlyUpdate: () => Promise<boolean>
  isTailwindContentUpdate: () => Promise<boolean>
}

export function createVueEntryUpdateInspector(
  state: CorePluginState,
  normalizedId: string,
  options: {
    readFile?: (file: string, encoding: 'utf-8') => Promise<string>
  } = {},
): VueEntryUpdateInspector {
  const readFile = options.readFile ?? fs.readFile
  let sourcePromise: Promise<string | undefined> | undefined
  let signatures: VueSfcHmrSignatures | undefined
  let changedBlocks: VueSfcBlockChanges | undefined

  async function loadSource() {
    sourcePromise ??= readFile(normalizedId, 'utf-8').catch(() => undefined)
    return await sourcePromise
  }

  async function resolveSignatures() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    signatures ??= resolveVueSfcHmrSignatures(source, normalizedId)
    return signatures
  }

  async function resolveChangedBlocks() {
    if (changedBlocks) {
      return changedBlocks
    }
    const previous = state.ctx.runtimeState.build.hmr.vueEntrySfcSignatures.get(normalizedId)
    const current = (await resolveSignatures())?.blockSignatures
    if (!previous || !current) {
      return undefined
    }
    changedBlocks = classifyVueSfcBlockChanges(previous, current)
    return changedBlocks
  }

  return {
    async getChangedBlocks() {
      return await resolveChangedBlocks()
    },
    async isAppShellTopologyUpdate() {
      if (!isAppVueFile(normalizedId)) {
        return false
      }

      const previous = state.ctx.runtimeState.build.hmr.vueEntryHasTemplate.get(normalizedId)
      if (previous === undefined) {
        return false
      }

      const current = (await resolveSignatures())?.hasTemplate
      return current !== undefined && current !== previous
    },

    async isJsonOnlyUpdate() {
      const blocks = await resolveChangedBlocks()
      return blocks?.length === 1 && blocks[0] === 'config'
    },

    async isLocalAssetOnlyUpdate() {
      const blocks = await resolveChangedBlocks()
      return Boolean(blocks && !blocks.includes('script'))
    },

    async isStyleOnlyUpdate() {
      const blocks = await resolveChangedBlocks()
      return blocks?.length === 1 && blocks[0] === 'style'
    },

    async isTailwindContentUpdate() {
      const previousTemplate = state.ctx.runtimeState.build.hmr.vueEntryTailwindTemplateContentSignatures?.get(normalizedId)
      const previousScript = state.ctx.runtimeState.build.hmr.vueEntryTailwindScriptContentSignatures?.get(normalizedId)
      if (!previousTemplate || !previousScript) {
        return true
      }

      const signatures = await resolveSignatures()
      const currentTemplate = signatures?.tailwindTemplateContentSignature
      if (!currentTemplate || currentTemplate !== previousTemplate) {
        return true
      }

      const currentScript = signatures.tailwindScriptContentSignature
      return !currentScript || currentScript !== previousScript
    },
  }
}
