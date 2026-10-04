import type { CompilerContext } from '../../context'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerSourceResolutionKey, getCompilerSourceResolutions, getCompilerSourceSnapshot, readCompilerInput, withCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../plugins/utils/vueSfc'
import { isSkippableResolvedId } from '../../utils/resolvedId'

/** 外部块预分析与编译共用一份输入，避免仅资源发射计划误剪新脚本。 */
export async function withVueStyleDependencySnapshot<T>(
  ctx: Pick<CompilerContext, 'runtimeState' | 'moduleGraphService' | 'configService'>,
  affectedEntries: Iterable<string>,
  changedFiles: Iterable<string>,
  run: (options?: { forceFullRescan: boolean }) => Promise<T>,
  onDrift: (files: Array<{ file: string, event: 'update' | 'delete' }>) => void,
): Promise<T> {
  const entries = new Set(Array.from(affectedEntries, compilerSourceId))
  const changed = new Set(Array.from(changedFiles, compilerSourceId))
  const candidates = [...ctx.runtimeState.build.hmr.vueEntryStyleBindings]
    .filter(([entry, bindings]) => ctx.runtimeState.build.hmr.resolvedEntryMap.has(entry)
      && (entries.has(compilerSourceId(entry)) || bindings.sources.some(file => changed.has(compilerSourceId(file)))))
    .map(([entry]) => entry)
  if (!candidates.length) {
    return await run()
  }

  const config = ctx.configService
  const previous = getCompilerSourceSnapshot(config)
  const sources = new Map(previous)
  const resolutions = new Map(getCompilerSourceResolutions(config))
  const resolved = new Map<string, { source: string, importer: string, id: string | undefined }>()
  const captured = new Map<string, string>()
  const pending = new Map<string, Promise<string>>()
  const resolving = new Map<string, Promise<string | undefined>>()
  const resolveSource = async (source: string, importer: string) => {
    const options = createReadAndParseSfcOptions(ctx.moduleGraphService, config)
    const id = await options.resolveSrc?.resolveId?.(source, importer)
    return id && isSkippableResolvedId(id) ? id : compilerSourceId(path.resolve(path.dirname(importer), id ?? source))
  }
  const capture = (file: string): Promise<string> => {
    const id = compilerSourceId(file)
    let read = pending.get(id)
    if (!read) {
      read = readCompilerInput(config, id).then((source) => {
        sources.set(id, source)
        // 外层快照已拥有的版本不属于本轮磁盘漂移检测。
        if (!previous?.has(id)) {
          captured.set(id, source)
        }
        return source
      })
      pending.set(id, read)
    }
    return read
  }
  const captures = await Promise.allSettled(candidates.map(async (entry) => {
    const options = createReadAndParseSfcOptions(ctx.moduleGraphService, config)
    await readAndParseSfc(entry, {
      ...options,
      source: await capture(entry),
      resolveSrc: {
        ...options.resolveSrc,
        readFile: capture,
        async resolveId(source, importer) {
          const owner = importer ?? entry
          const key = compilerSourceResolutionKey(source, owner)
          if (resolutions.has(key)) {
            return resolutions.get(key)
          }
          let resolution = resolving.get(key)
          if (!resolution) {
            resolution = resolveSource(source, owner).then((id) => {
              resolutions.set(key, id)
              resolved.set(key, { source, importer: owner, id })
              return id
            })
            resolving.set(key, resolution)
          }
          return await resolution
        },
      },
    })
  }))
  if (captures.some(result => result.status === 'rejected')) {
    // 解析失败时等待并行读完，再交回原生完整构建负责诊断和恢复依赖。
    let pendingCount: number
    do {
      pendingCount = pending.size + resolving.size
      await Promise.allSettled([...pending.values(), ...resolving.values()])
    } while (pendingCount !== pending.size + resolving.size)
    return await run({ forceFullRescan: true })
  }

  let result: T | undefined
  let failed = false
  let buildError: unknown
  try {
    result = await withCompilerSourceSnapshot(config, sources, run, resolutions)
  }
  catch (error) {
    failed = true
    buildError = error
  }
  try {
    const drift = await Promise.all([...captured].map(async ([file, source]) => {
      try {
        return await fs.readFile(file, 'utf8') === source ? undefined : { file, event: 'update' as const }
      }
      catch (error) {
        // 删除、重命名和读取失败都需要下一批重新分析，不能依赖 watcher 补报。
        return { file, event: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'delete' as const : 'update' as const }
      }
    }))
    for (const { source, importer, id } of resolved.values()) {
      try {
        if (await resolveSource(source, importer) !== id) {
          drift.push({ file: importer, event: 'update' })
        }
      }
      catch {
        drift.push({ file: importer, event: 'update' })
      }
    }
    const files = drift.filter((file): file is NonNullable<typeof file> => file !== undefined)
    if (files.length) {
      onDrift(files)
    }
  }
  catch (error) {
    if (failed) {
      throw new AggregateError([buildError, error], 'Snapshot build and source drift scheduling failed', { cause: buildError })
    }
    throw error
  }
  if (failed) {
    throw buildError
  }
  return result as T
}
