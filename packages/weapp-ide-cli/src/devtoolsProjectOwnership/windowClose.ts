import type { ManagedWechatProjectRecord, ManagedWechatWindowCloseEvidence } from './types'
import fs from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { readManagedProcessIdentity, sameManagedProcess } from './host'
import { readActiveMainLog } from './windowClose/activeLog'
import { captureActiveLogCursor, captureLogCursors, legacyLogInventoryFailure, readFreshLogLines, recoverLogCursors, selectedLogDirectory } from './windowClose/logCursor'
import { consumeWindowCloseTrace } from './windowClose/protocol'

/** 只捕获本次显式安装的日志，必须先于关闭命令持久化。 */
export async function captureManagedWindowClose(record: ManagedWechatProjectRecord): Promise<ManagedWechatWindowCloseEvidence> {
  if (!record.target.version) {
    throw new Error('Managed DevTools window-close evidence requires the selected product version.')
  }
  const profileDir = await fs.realpath(record.target.profileDir)
  const capturedAt = new Date().toISOString()
  const directory = await selectedLogDirectory(profileDir)
  const active = await readActiveMainLog(record, directory)
  const cursors = active
    ? await captureActiveLogCursor(directory, active)
    : await captureLogCursors(directory, record.target.version)
  return { protocol: 'wechat-devtools-window-close-trace-v1', profileDir, productVersion: record.target.version, capturedAt, ...(active ? { mainHost: active.host } : {}), cursors, calls: [] }
}

/** 持久化每轮证据，worker 退出后只能续读同一游标，不能重新关闭同路径。 */
export async function waitForManagedWindowClosed(record: ManagedWechatProjectRecord, persist: () => Promise<void>, options: { timeoutMs?: number, pollMs?: number } = {}) {
  const evidence = record.windowClose
  if (!evidence || !evidence.dispatchedAt) {
    throw new Error('Managed DevTools project close has no durable native-window evidence cursor.')
  }
  if (evidence.failure) {
    if (evidence.failure !== legacyLogInventoryFailure) {
      throw new Error(evidence.failure)
    }
    if (await fs.realpath(record.target.profileDir) !== evidence.profileDir || record.target.version !== evidence.productVersion) {
      throw new Error('Managed DevTools window-close evidence no longer matches its selected installation.')
    }
    const cursors = await recoverLogCursors(await selectedLogDirectory(evidence.profileDir), evidence.cursors, evidence.productVersion)
    const mainIdentity = cursors[0]!.identity
    if (evidence.calls.some(call => call.fileIdentity !== mainIdentity) || (evidence.window && evidence.window.fileIdentity !== mainIdentity)) {
      throw new Error('Managed DevTools legacy window-close references do not belong to its original MAIN evidence stream.')
    }
    evidence.logInventoryRecovery = { failure: evidence.failure, cursors: evidence.cursors.map(cursor => ({ ...cursor })) }
    evidence.cursors = cursors
    delete evidence.failure
    await persist()
  }
  const deadline = Date.now() + (options.timeoutMs ?? 15_000)
  do {
    try {
      if (await fs.realpath(record.target.profileDir) !== evidence.profileDir || record.target.version !== evidence.productVersion) {
        throw new Error('Managed DevTools window-close evidence no longer matches its selected installation.')
      }
      if (evidence.mainHost) {
        const current = await readManagedProcessIdentity(evidence.mainHost.pid)
        if (!current || !sameManagedProcess(current, evidence.mainHost)) {
          throw new Error('Managed DevTools main log owner changed; destruction evidence is unresolved.')
        }
      }
      const lines = await readFreshLogLines(await selectedLogDirectory(evidence.profileDir), evidence.cursors)
      for (const line of lines) {
        consumeWindowCloseTrace(evidence, record.projectPath, line)
      }
    }
    catch (error) {
      evidence.failure = error instanceof Error ? error.message : String(error)
      await persist()
      throw error
    }
    await persist()
    if (evidence.window?.nativeClosedAt && evidence.window.webContentsDestroyedAt) {
      return
    }
    if (Date.now() >= deadline) {
      break
    }
    await setTimeout(options.pollMs ?? 100)
  } while (true)
  throw new Error('Managed DevTools project close has no complete native-window destruction evidence; stop the acceptance lane.')
}
