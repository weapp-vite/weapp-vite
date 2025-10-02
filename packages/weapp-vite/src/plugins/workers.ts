import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { ChangeEvent } from '../types'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'
import { findJsEntry, isJsOrTs } from '../utils'

export function workers(ctx: CompilerContext): Plugin[] {
  if (!ctx.scanService.workersDir) {
    return []
  }

  return [createWorkerBuildPlugin(ctx)]
}

function createWorkerBuildPlugin(ctx: CompilerContext): Plugin {
  const { configService, scanService } = ctx

  return {
    name: 'weapp-vite:workers',
    enforce: 'pre',

    async options(options) {
      const workerConfig = configService.weappViteConfig?.worker
      const entries = Array.isArray(workerConfig?.entry)
        ? workerConfig.entry
        : [workerConfig?.entry]

      const normalized = (await Promise.all(entries.filter(Boolean).map(entry => resolveWorkerEntry(ctx, entry!))))
        .filter((result): result is { key: string, value: string } => Boolean(result.value))
        .reduce<Record<string, string>>((acc, cur) => {
          acc[cur.key] = cur.value
          return acc
        }, {})

      options.input = normalized
    },

    watchChange(id: string, change: { event: ChangeEvent }) {
      logger.success(`[workers:${change.event}] ${configService.relativeCwd(id)}`)
    },

    outputOptions(options) {
      options.chunkFileNames = (chunkInfo) => {
        return path.join(scanService.workersDir ?? '', chunkInfo.isDynamicEntry ? '[name].js' : '[name]-[hash].js')
      }
    },
  }
}

async function resolveWorkerEntry(
  ctx: CompilerContext,
  entry: string,
): Promise<{ key: string, value?: string }> {
  const { configService, scanService } = ctx
  const relativeEntryPath = path.join(scanService.workersDir!, entry)
  const key = removeExtension(relativeEntryPath)
  const absoluteEntry = path.resolve(configService.absoluteSrcRoot, relativeEntryPath)

  if (isJsOrTs(entry)) {
    const exists = await fs.exists(absoluteEntry)
    if (!exists) {
      logger.warn(`引用 worker: \`${configService.relativeCwd(relativeEntryPath)}\` 不存在!`)
      return { key }
    }

    return { key, value: absoluteEntry }
  }

  const { path: discovered } = await findJsEntry(absoluteEntry)
  if (!discovered) {
    logger.warn(`引用 worker: \`${configService.relativeCwd(relativeEntryPath)}\` 不存在!`)
    return { key }
  }

  return { key, value: discovered }
}
