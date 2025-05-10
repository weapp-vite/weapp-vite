import type { CompilerContext } from '@/context'
import type { ChangeEvent } from 'rollup'
import type { Plugin } from 'vite'
import logger from '@/logger'
import { findJsEntry, isJsOrTs } from '@/utils'
import { removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'

export function workers({ configService, scanService }: CompilerContext): Plugin[] {
  const plugins: Plugin[] = []
  if (scanService.workersDir) {
    plugins.push({
      name: 'weapp-vite:workers',
      enforce: 'pre',
      async options(options) {
        const workerOptions = configService.weappViteConfig?.worker
        const entries = (
          Array.isArray(workerOptions?.entry) ? workerOptions?.entry : [workerOptions?.entry]
        ).filter(x => x) as string[]
        const pq = await Promise.all(
          entries.map(async (entry) => {
            const relativeEnrtyPath = path.join(scanService.workersDir!, entry)
            const key = removeExtension(relativeEnrtyPath)
            const findPath = path.resolve(configService.absoluteSrcRoot, relativeEnrtyPath)
            let result: { key: string, value?: string }
            let isExisted = false
            if (isJsOrTs(entry)) {
              isExisted = await fs.exists(findPath)
              result = {
                key,
                value: findPath,
              }
            }
            else {
              const { path: filepath } = await findJsEntry(findPath)
              isExisted = Boolean(filepath)
              result = {
                key,
                value: filepath,
              }
            }
            if (!isExisted) {
              logger.warn(`引用 worker: \`${configService.relativeCwd(relativeEnrtyPath)}\` 不存在!`)
            }
            return result
          }),
        )
        const input = pq.reduce<Record<string, string>>((acc, cur) => {
          if (cur.value) {
            acc[cur.key] = cur.value
          }
          return acc
        }, {})
        options.input = input
      },
      watchChange(id: string, change: { event: ChangeEvent }) {
        logger.success(`[workers:${change.event}] ${configService.relativeCwd(id)}`)
      },
      outputOptions(options) {
        options.chunkFileNames = (chunkInfo) => {
          return path.join(scanService.workersDir ?? '', chunkInfo.isDynamicEntry ? '[name].js' : '[name]-[hash].js')
        }
      },
    })
  }
  return plugins
}
