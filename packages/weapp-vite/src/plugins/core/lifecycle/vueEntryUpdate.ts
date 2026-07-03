import type { CorePluginState } from '../helpers'
import { fs } from '@weapp-core/shared/fs'
import { resolveVueSfcHmrSignatures } from '../../../utils/file/vueSfcSignature'
import { isAppVueFile } from '../../vue/transform/appShell'

export interface VueEntryUpdateInspector {
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
  let signatures: ReturnType<typeof resolveVueSfcHmrSignatures> | undefined

  async function loadSource() {
    sourcePromise ??= readFile(normalizedId, 'utf-8').catch(() => undefined)
    return await sourcePromise
  }

  async function resolveSignatures() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    if (!signatures) {
      signatures = resolveVueSfcHmrSignatures(source, normalizedId)
    }
    return signatures
  }

  return {
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
      const previous = state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return (await resolveSignatures())?.nonJsonSignature === previous
    },

    async isLocalAssetOnlyUpdate() {
      const previous = state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return (await resolveSignatures())?.scriptSignature === previous
    },

    async isStyleOnlyUpdate() {
      const previous = state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return (await resolveSignatures())?.styleIndependentSignature === previous
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
