import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { appendIdeReportEvent } from './ideWarningReport'

const transportFiles = new Set([
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
])

export function hashHmrOutput(source: string | Uint8Array) {
  return createHash('sha256').update(source).digest('hex')
}

/** 按相对路径记录磁盘产物；指纹仅用于诊断，不作为构建完成或重启的信号。 */
export async function readHmrOutputIdentity(dist: string) {
  const names = (await readdir(dist, { recursive: true }))
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => /\.(?:[cm]?js|json|wxml|wxss)$/.test(file))
    .sort()
  const files = await Promise.all(names.map(async (file) => {
    const kind = transportFiles.has(file)
      ? 'transport' as const
      : /\.[cm]?js$/.test(file) ? 'startup-script' as const : 'asset' as const
    try {
      const source = await readFile(path.join(dist, file))
      return { file, kind, bytes: source.length, hash: hashHmrOutput(source) }
    }
    catch (error) {
      return { file, kind, error: error instanceof Error && 'code' in error ? String(error.code) : 'read-failed' }
    }
  }))
  const identity = (kind: (typeof files)[number]['kind']) => hashHmrOutput(JSON.stringify(
    files.filter(file => file.kind === kind).map(file => [file.file, file.hash ?? file.error]),
  ))
  return {
    startupHash: identity('startup-script'),
    transportHash: identity('transport'),
    assetHash: identity('asset'),
    files,
  }
}

/** 保留前后产物差异及 VM 已加载的入口指纹，观察本身不改变连接或文件。 */
export function createHmrOutputDiagnostics(dist: string, project: string) {
  let previous: Awaited<ReturnType<typeof readHmrOutputIdentity>> | undefined
  return {
    async capture(label: string, loadedEntry: string) {
      try {
        const snapshot = await readHmrOutputIdentity(dist)
        const before = new Map(previous?.files.map(file => [file.file, file.hash ?? file.error]))
        const after = new Map(snapshot.files.map(file => [file.file, file.hash ?? file.error]))
        const changedFiles = [...new Set([...before.keys(), ...after.keys()])]
          .filter(file => before.get(file) !== after.get(file))
          .sort()
        const text = JSON.stringify({ label, loadedEntryHash: hashHmrOutput(loadedEntry), changedFiles, ...snapshot })
        previous = snapshot
        appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-output-diagnostics', project, label, text })
        process.stdout.write(`[hmr-output-diagnostics] ${text}\n`)
      }
      catch (error) {
        // 诊断失败不能覆盖原始运行时断言，也不输出机器绝对路径。
        const text = JSON.stringify({ label, error: error instanceof Error ? error.name : typeof error })
        appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-output-diagnostics', project, label, text })
        process.stdout.write(`[hmr-output-diagnostics] ${text}\n`)
      }
    },
  }
}
