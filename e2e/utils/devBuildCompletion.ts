import type { startDevProcess } from './dev-process'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'

type DevProcess = Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>

interface SourcePublication {
  file: string
  profilePath: string
}

function normalizedSource(file: string) {
  return path.normalize(file.replaceAll('\\', '/')).replace(/^[A-Z]:/, drive => drive.toLowerCase())
}

function captureSourcePublication(source: SourcePublication) {
  let previousContent = ''
  try {
    previousContent = readFileSync(source.profilePath, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  // 两个进程的 performance.now() 原点不同；统一换算为 timeOrigin + 毫秒，不能用完成日志时间归因。
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const file = normalizedSource(source.file)
  let profileStatus = 'not-read'
  let samples: ReturnType<typeof readHmrProfileLines>['samples'] = []
  const check = async (signal: AbortSignal) => {
    let content: string
    try {
      content = await readFile(source.profilePath, { encoding: 'utf8', signal })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        profileStatus = 'missing'
        return false
      }
      throw error
    }
    // 文件被截断或替换后重新从头读取；事件时钟仍会拒绝旧来源，不沿用失效的字符游标。
    const offset = content.startsWith(previousContent) ? previousContent.length : 0
    // appendFile 尚未写完的行不能成为完成证据；下次仍从同一游标重新读取。
    const completeLines = content.slice(offset, content.lastIndexOf('\n') + 1)
    profileStatus = 'read'
    samples = readHmrProfileLines(completeLines).samples
    return samples.some(sample => sample.schemaVersion === 1
      && sample.status === 'complete'
      && sample.correlation === 'known'
      && Boolean(sample.buildId && sample.batchId)
      && sample.clock?.durations === 'performance.now'
      && Number.isFinite(sample.clock.timeOrigin)
      && sample.clock.timeOrigin > 0
      && sample.sourceEvents?.some(event => event.file
        && normalizedSource(event.file) === file
        && sample.clock!.timeOrigin + event.receivedAtMs >= capturedAtEpochMs))
  }
  return {
    check,
    diagnostics: () => JSON.stringify({
      file,
      capturedAtEpochMs,
      profileStatus,
      samples: samples.slice(-4).map(sample => ({
        status: sample.status,
        correlation: sample.correlation,
        buildId: sample.buildId,
        batchId: sample.batchId,
        clock: sample.clock,
        sourceEvents: sample.sourceEvents,
      })),
    }),
  }
}

/** 在编辑前记录游标；文件提前可见或上一轮完成日志都不能代替本轮发布完成。 */
export function createDevBuildCompletion(dev: DevProcess, options: {
  completed: string
  started?: string
  source?: SourcePublication
}) {
  const offset = dev.getOutput().length
  const sourcePublished = options.source && captureSourcePublication(options.source)
  return {
    async wait(timeoutMs = 30_000): Promise<void> {
      const completion = Promise.withResolvers<void>()
      const reads = new AbortController()
      let active = true
      let checking = false
      const check = async () => {
        if (!active || checking) {
          return
        }
        checking = true
        try {
          const output = dev.getOutput().slice(offset)
          const completedAt = output.lastIndexOf(options.completed)
          const startedAt = options.started ? output.lastIndexOf(options.started) : -1
          const published = completedAt >= 0 && completedAt > startedAt
            && (!sourcePublished || await sourcePublished.check(reads.signal))
          if (active && published) {
            completion.resolve()
          }
        }
        catch (error) {
          if (active) {
            completion.reject(error)
          }
        }
        finally {
          checking = false
        }
      }
      const interval = setInterval(() => {
        void check()
      }, 25)
      const deadline = setTimeout(() => {
        const diagnostics = sourcePublished ? `\nSource publication: ${sourcePublished.diagnostics()}` : ''
        completion.reject(new Error(`Timed out waiting for current dev build: ${options.completed}${diagnostics}`))
      }, timeoutMs)
      try {
        void check()
        await dev.waitFor(completion.promise, 'current dev build publication')
      }
      finally {
        active = false
        reads.abort()
        clearInterval(interval)
        clearTimeout(deadline)
      }
    },
  }
}
