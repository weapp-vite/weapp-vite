import type { CorePluginState } from '../helpers'
import { fs } from '@weapp-core/shared/fs'
import { resolveVueSfcHasTemplate, resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature } from '../../../utils/file/vueSfcSignature'
import { isAppVueFile } from '../../vue/transform/appShell'

export interface VueEntryUpdateInspector {
  isAppShellTopologyUpdate: () => Promise<boolean>
  isJsonOnlyUpdate: () => Promise<boolean>
  isLocalAssetOnlyUpdate: () => Promise<boolean>
  isStyleOnlyUpdate: () => Promise<boolean>
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
  let hasTemplate: boolean | undefined
  let hasTemplateResolved = false
  let nonJsonSignature: string | undefined
  let nonJsonSignatureResolved = false
  let scriptSignature: string | undefined
  let scriptSignatureResolved = false
  let styleIndependentSignature: string | undefined
  let styleIndependentSignatureResolved = false

  async function loadSource() {
    sourcePromise ??= readFile(normalizedId, 'utf-8').catch(() => undefined)
    return await sourcePromise
  }

  async function resolveNonJsonSignature() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    if (!nonJsonSignatureResolved) {
      nonJsonSignature = resolveVueSfcNonJsonSignature(source, normalizedId)
      nonJsonSignatureResolved = true
    }
    return nonJsonSignature
  }

  async function resolveScriptSignature() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    if (!scriptSignatureResolved) {
      scriptSignature = resolveVueSfcScriptSignature(source, normalizedId)
      scriptSignatureResolved = true
    }
    return scriptSignature
  }

  async function resolveStyleIndependentSignature() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    if (!styleIndependentSignatureResolved) {
      styleIndependentSignature = resolveVueSfcStyleIndependentSignature(source, normalizedId)
      styleIndependentSignatureResolved = true
    }
    return styleIndependentSignature
  }

  async function resolveHasTemplate() {
    const source = await loadSource()
    if (source === undefined) {
      return undefined
    }
    if (!hasTemplateResolved) {
      hasTemplate = resolveVueSfcHasTemplate(source, normalizedId)
      hasTemplateResolved = true
    }
    return hasTemplate
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

      const current = await resolveHasTemplate()
      return current !== undefined && current !== previous
    },

    async isJsonOnlyUpdate() {
      const previous = state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return await resolveNonJsonSignature() === previous
    },

    async isLocalAssetOnlyUpdate() {
      const previous = state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return await resolveScriptSignature() === previous
    },

    async isStyleOnlyUpdate() {
      const previous = state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.get(normalizedId)
      if (!previous) {
        return false
      }

      return await resolveStyleIndependentSignature() === previous
    },
  }
}
