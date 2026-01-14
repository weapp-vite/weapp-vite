import type { MutableCompilerContext } from '../../../context'
import type { OutputsState } from './state'
import { logger } from '../../../context/shared'
import {
  getAutoImportConfig,
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
  resolveManifestOutputPath,
} from '../config'

interface ScheduleOptions {
  ctx: MutableCompilerContext
  outputsState: OutputsState
  manifestFileName: string
  writeManifest: (outputPath: string) => Promise<void>
  syncTyped: (settings: ReturnType<typeof getTypedComponentsSettings>) => Promise<void>
  syncHtmlCustomData: (settings: ReturnType<typeof getHtmlCustomDataSettings>) => Promise<void>
  syncVueComponents: (settings: ReturnType<typeof getVueComponentsSettings>) => Promise<void>
}

export function createScheduleHelpers(options: ScheduleOptions) {
  const {
    ctx,
    outputsState,
    manifestFileName,
    writeManifest,
    syncTyped,
    syncHtmlCustomData: syncHtml,
    syncVueComponents: syncVue,
  } = options

  function scheduleHtmlCustomDataWrite(shouldWrite: boolean) {
    const settings = getHtmlCustomDataSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastHtmlCustomDataEnabled
      || settings.outputPath !== outputsState.lastHtmlCustomDataOutput

    if (!shouldWrite && !configChanged && !outputsState.lastHtmlCustomDataOutputPath) {
      return
    }

    outputsState.htmlCustomDataWriteRequested = true
    if (outputsState.pendingHtmlCustomDataWrite) {
      return
    }

    outputsState.pendingHtmlCustomDataWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.htmlCustomDataWriteRequested) {
          outputsState.htmlCustomDataWriteRequested = false
          const currentSettings = getHtmlCustomDataSettings(ctx)
          await syncHtml(currentSettings)
          outputsState.lastHtmlCustomDataEnabled = currentSettings.enabled
          outputsState.lastHtmlCustomDataOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingHtmlCustomDataWrite = undefined
      })
  }

  async function scheduleManifestWrite(shouldWrite: boolean) {
    if (!shouldWrite) {
      return
    }

    const configService = ctx.configService
    if (!getAutoImportConfig(configService)) {
      return
    }

    outputsState.writeRequested = true
    if (outputsState.pendingWrite) {
      return
    }

    outputsState.pendingWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.writeRequested) {
          outputsState.writeRequested = false
          const outputPath = resolveManifestOutputPath(ctx.configService, manifestFileName)
          if (!outputPath) {
            return
          }
          try {
            await writeManifest(outputPath)
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error(`自动导出组件清单失败: ${message}`)
          }
        }
      })
      .finally(() => {
        outputsState.pendingWrite = undefined
      })
  }

  function scheduleTypedComponentsWrite(shouldWrite: boolean) {
    const settings = getTypedComponentsSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastTypedComponentsEnabled
      || settings.outputPath !== outputsState.lastTypedComponentsOutput

    if (!shouldWrite && !configChanged && !outputsState.lastTypedDefinitionOutputPath) {
      return
    }

    outputsState.typedWriteRequested = true
    if (outputsState.pendingTypedWrite) {
      return
    }

    outputsState.pendingTypedWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.typedWriteRequested) {
          outputsState.typedWriteRequested = false
          const currentSettings = getTypedComponentsSettings(ctx)
          await syncTyped(currentSettings)
          outputsState.lastTypedComponentsEnabled = currentSettings.enabled
          outputsState.lastTypedComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingTypedWrite = undefined
      })
  }

  function scheduleVueComponentsWrite(shouldWrite: boolean) {
    const settings = getVueComponentsSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastVueComponentsEnabled
      || settings.outputPath !== outputsState.lastVueComponentsOutput

    if (!shouldWrite && !configChanged && !outputsState.lastVueComponentsOutputPath) {
      return
    }

    outputsState.vueComponentsWriteRequested = true
    if (outputsState.pendingVueComponentsWrite) {
      return
    }

    outputsState.pendingVueComponentsWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.vueComponentsWriteRequested) {
          outputsState.vueComponentsWriteRequested = false
          const currentSettings = getVueComponentsSettings(ctx)
          await syncVue(currentSettings)
          outputsState.lastVueComponentsEnabled = currentSettings.enabled
          outputsState.lastVueComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingVueComponentsWrite = undefined
      })
  }

  return {
    scheduleManifestWrite,
    scheduleTypedComponentsWrite,
    scheduleHtmlCustomDataWrite,
    scheduleVueComponentsWrite,
  }
}
