import type { OutputsHelpers } from './outputs'
import type { AutoImportOutputSettingsSnapshot } from './types'
import {
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
} from '../config'

interface SchedulingOptions {
  ctx: Parameters<typeof getTypedComponentsSettings>[0]
  outputsHelpers: OutputsHelpers
}

export function createAutoImportScheduling(options: SchedulingOptions) {
  const batchedWrites: {
    depth: number
    manifest?: boolean
    typed?: boolean
    html?: boolean
    vue?: boolean
  } = {
    depth: 0,
    manifest: undefined,
    typed: undefined,
    html: undefined,
    vue: undefined,
  }
  let outputSettingsSnapshot: AutoImportOutputSettingsSnapshot | undefined

  function getOutputSettingsSnapshot(): AutoImportOutputSettingsSnapshot {
    if (!outputSettingsSnapshot) {
      outputSettingsSnapshot = {
        typed: getTypedComponentsSettings(options.ctx),
        html: getHtmlCustomDataSettings(options.ctx),
        vue: getVueComponentsSettings(options.ctx),
      }
    }
    return outputSettingsSnapshot
  }

  function deferOrSchedule(kind: 'manifest' | 'typed' | 'html' | 'vue', shouldWrite: boolean) {
    if (batchedWrites.depth > 0) {
      const previous = batchedWrites[kind]
      batchedWrites[kind] = previous === undefined ? shouldWrite : previous || shouldWrite
      return
    }

    if (kind === 'manifest') {
      options.outputsHelpers.scheduleManifestWrite(shouldWrite)
      return
    }
    if (kind === 'typed') {
      options.outputsHelpers.scheduleTypedComponentsWrite(shouldWrite)
      return
    }
    if (kind === 'html') {
      options.outputsHelpers.scheduleHtmlCustomDataWrite(shouldWrite)
      return
    }
    options.outputsHelpers.scheduleVueComponentsWrite(shouldWrite)
  }

  function flushBatchedWrites() {
    const manifest = batchedWrites.manifest
    const typed = batchedWrites.typed
    const html = batchedWrites.html
    const vue = batchedWrites.vue
    batchedWrites.manifest = undefined
    batchedWrites.typed = undefined
    batchedWrites.html = undefined
    batchedWrites.vue = undefined

    if (manifest !== undefined) {
      options.outputsHelpers.scheduleManifestWrite(manifest)
    }
    if (typed !== undefined) {
      options.outputsHelpers.scheduleTypedComponentsWrite(typed)
    }
    if (html !== undefined) {
      options.outputsHelpers.scheduleHtmlCustomDataWrite(html)
    }
    if (vue !== undefined) {
      options.outputsHelpers.scheduleVueComponentsWrite(vue)
    }
  }

  async function runInBatch<T>(task: () => T | Promise<T>) {
    batchedWrites.depth += 1
    try {
      return await task()
    }
    finally {
      batchedWrites.depth -= 1
      if (batchedWrites.depth === 0) {
        flushBatchedWrites()
      }
    }
  }

  return {
    getOutputSettingsSnapshot,
    deferOrSchedule,
    runInBatch,
  }
}
