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
  isCompilerContentUpdate: (provider?: string) => Promise<boolean>
  isTailwindContentUpdate: () => Promise<boolean>
}

const DEFAULT_COMPILER_CONTENT_PROVIDER = 'tailwindcss'

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
      // 模板也会生成 computed、事件表和绑定清单；是否产生 JS patch 交给原生模块图判断。
      return Boolean(blocks && !blocks.includes('script') && !blocks.includes('template'))
    },

    async isStyleOnlyUpdate() {
      const blocks = await resolveChangedBlocks()
      return blocks?.length === 1 && blocks[0] === 'style'
    },

    async isCompilerContentUpdate(provider = DEFAULT_COMPILER_CONTENT_PROVIDER) {
      const hmr = state.ctx.runtimeState.build.hmr
      const previousContent = hmr.vueEntryContentSignatures?.get(normalizedId)?.[provider]
      const previousTemplate = hmr.vueEntryTemplateContentSignatures?.get(normalizedId)?.[provider]
        ?? (provider === DEFAULT_COMPILER_CONTENT_PROVIDER
          ? hmr.vueEntryTailwindTemplateContentSignatures?.get(normalizedId)
          : undefined)
      const previousScript = hmr.vueEntryScriptContentSignatures?.get(normalizedId)?.[provider]
        ?? (provider === DEFAULT_COMPILER_CONTENT_PROVIDER
          ? hmr.vueEntryTailwindScriptContentSignatures?.get(normalizedId)
          : undefined)
      if (!previousContent && (!previousTemplate || !previousScript)) {
        return true
      }

      const signatures = await resolveSignatures()
      const currentContent = signatures?.contentSignatures?.[provider]
      if (previousContent) {
        return !currentContent || currentContent !== previousContent
      }
      const currentTemplate = signatures?.templateContentSignatures?.[provider]
        ?? (provider === DEFAULT_COMPILER_CONTENT_PROVIDER
          ? signatures?.tailwindTemplateContentSignature
          : undefined)
      if (!currentTemplate || currentTemplate !== previousTemplate) {
        return true
      }

      const currentScript = signatures?.scriptContentSignatures?.[provider]
        ?? (provider === DEFAULT_COMPILER_CONTENT_PROVIDER
          ? signatures?.tailwindScriptContentSignature
          : undefined)
      return !currentScript || currentScript !== previousScript
    },

    async isTailwindContentUpdate() {
      return await this.isCompilerContentUpdate(DEFAULT_COMPILER_CONTENT_PROVIDER)
    },
  }
}
