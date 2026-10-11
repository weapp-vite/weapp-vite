import type { NativeInspectorHeapIdentity } from './protocol'
import { watch } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { createNativeInspectorHeapCollector } from './index'
import { isRecord } from './protocol'

const INSTALLATION_TIMEOUT_MS = 120_000

/** 只读本轮操作员输入；已有文件、畸形输入和上一 session 的地址均不能复用。 */
export async function readNativeInspectorTarget(filePath: string, sessionId: string, timeoutMs = INSTALLATION_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    let reading = false
    let changed = false
    let watcher: ReturnType<typeof watch> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: unknown, targetUrl?: string) => {
      if (settled) {
        return
      }
      settled = true
      watcher?.close()
      clearTimeout(timer)
      if (error) {
        reject(error)
      }
      else {
        resolve(targetUrl!)
      }
    }
    const read = async () => {
      if (reading || settled) {
        changed = true
        return
      }
      reading = true
      changed = false
      try {
        const text = await fs.readFile(filePath, 'utf8')
        if (text.length > 65_536) {
          throw new Error('Native Inspector target input exceeds its limit')
        }
        const input: unknown = JSON.parse(text)
        if (!isRecord(input) || input.sessionId !== sessionId || typeof input.targetUrl !== 'string') {
          throw new Error('Native Inspector target input belongs to another session or is invalid')
        }
        finish(undefined, input.targetUrl)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          finish(error)
        }
      }
      finally {
        reading = false
        if (changed && !settled) {
          void read()
        }
      }
    }
    watcher = watch(path.dirname(filePath), (_event, name) => {
      if (name === path.basename(filePath)) {
        void read()
      }
    })
    watcher.once('error', finish)
    timer = setTimeout(() => finish(new Error('Native Inspector Console installation input timed out')), timeoutMs)
    void read()
  })
}

/** 手工安装只在计时之外等待；全部原始回传保留，收尾失败不跳过回环 server 关闭。 */
export async function prepareNativeInspectorBench(options: {
  directory: string
  identity: Omit<NativeInspectorHeapIdentity, 'targetUrl'>
  preset: string
  resource: { projectPath: string, wsEndpoint: string, port: number }
  log: (message: string) => void
}) {
  await fs.mkdir(options.directory, { recursive: false })
  const requestPath = path.join(options.directory, 'request.json')
  const inputPath = path.join(options.directory, 'target.json')
  const expressionPath = path.join(options.directory, 'console.js')
  const rawPath = path.join(options.directory, 'raw.json')
  const publish = async (phase: string, extra: Record<string, unknown> = {}) => {
    const temporary = `${requestPath}.tmp`
    await fs.writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, phase, ...options.identity, preset: options.preset, resource: options.resource, inputPath, ...extra }, null, 2)}\n`)
    await fs.rename(temporary, requestPath)
  }
  await publish('target-required')
  options.log(`native Inspector target required: ${requestPath}`)
  const targetUrl = await readNativeInspectorTarget(inputPath, options.identity.sessionId)
  const collector = await createNativeInspectorHeapCollector({ ...options.identity, targetUrl })
  let installationError: unknown
  let closing: Promise<void> | undefined
  const close = () => closing ??= (async () => {
    const errors: unknown[] = []
    try {
      await collector.close()
    }
    catch (error) {
      errors.push(error)
    }
    try {
      await fs.writeFile(rawPath, `${JSON.stringify({ identity: collector.identity, state: collector.state, installationError: installationError instanceof Error ? installationError.message : installationError, records: collector.records, rawResponses: collector.rawResponses }, null, 2)}\n`)
      await publish(errors.length || installationError ? 'failed' : 'closed', { targetUrl, rawPath })
    }
    catch (error) {
      errors.push(error)
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Native Inspector collector cleanup failed')
    }
  })()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await fs.writeFile(expressionPath, collector.consoleExpression, { flag: 'wx', mode: 0o600 })
    await publish('install-required', { targetUrl, expressionPath })
    options.log(`native Inspector Console expression ready: ${expressionPath}`)
    await Promise.race([
      collector.ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Native Inspector Console handshake timed out')), INSTALLATION_TIMEOUT_MS)
      }),
    ])
    await publish('sampling', { targetUrl, endpoint: collector.endpoint })
  }
  catch (error) {
    installationError = error
    try {
      await close()
    }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Native Inspector installation and cleanup failed')
    }
    throw error
  }
  finally {
    clearTimeout(timer)
  }
  return { collector, close }
}
