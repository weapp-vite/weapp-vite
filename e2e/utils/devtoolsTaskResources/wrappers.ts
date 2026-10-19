import type { TaskResourceReport, WrapperResourceEvent, WrapperResourceEventType } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import process from 'node:process'

export const TASK_RESOURCE_EVENTS_ENV = 'WEAPP_VITE_E2E_TASK_RESOURCE_EVENTS_PATH'
export const TASK_RESOURCE_EVENT_ERROR_MARKER = '[ide-task-resource-event-error]'
const eventTypes = new Set<WrapperResourceEventType>(['snapshot-created', 'watcher-started', 'watcher-stopped', 'watcher-error', 'snapshot-deleted', 'snapshot-delete-error', 'watcher-stop-error'])

/** 只向父 task 显式提供的文件追加被动事件；记录失败不得阻断资源收尾。 */
export function recordWrapperResourceEvent(type: WrapperResourceEventType, wrapperRoot: string, watcherId?: string, error?: unknown) {
  const file = process.env[TASK_RESOURCE_EVENTS_ENV]
  if (!file) {
    return
  }
  try {
    const event: WrapperResourceEvent = { type, wrapperRoot, watcherId, at: new Date().toISOString(), pid: process.pid }
    if (error !== undefined) {
      event.error = error instanceof Error ? error.message : String(error)
    }
    // 不带 O_CREAT，文件消失后不能重建并把截断历史误作完整事件流。
    const descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0))
    try {
      if (!fs.fstatSync(descriptor).isFile() || fs.lstatSync(file).isSymbolicLink()) {
        throw new Error('Bridge wrapper resource events require the initialized regular file.')
      }
      fs.appendFileSync(descriptor, `${JSON.stringify(event)}\n`)
    }
    finally {
      fs.closeSync(descriptor)
    }
  }
  catch {
    // 父 runner 将此标记纳入附件错误；不能为了诊断写盘失败跳过 watcher 关闭。
    process.stderr.write(`${TASK_RESOURCE_EVENT_ERROR_MARKER} Failed to persist an instrumented bridge wrapper lifecycle event.\n`)
  }
}

/** 每次真实 watcher 创建分配独立标识，避免重建后的停止事件覆盖旧实例。 */
export function createWrapperWatcherId() {
  return randomUUID()
}

export function parseWrapperResourceEvents(text: string): WrapperResourceEvent[] {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const value: unknown = JSON.parse(line)
    if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string' || !eventTypes.has(value.type as WrapperResourceEventType)
      || !('at' in value) || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))
      || !('pid' in value) || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 0
      || !('wrapperRoot' in value) || typeof value.wrapperRoot !== 'string'
      || ('watcherId' in value && value.watcherId !== undefined && typeof value.watcherId !== 'string')
      || (value.type.startsWith('watcher-') && (!('watcherId' in value) || typeof value.watcherId !== 'string' || !value.watcherId))
      || ('error' in value && value.error !== undefined && typeof value.error !== 'string')) {
      throw new Error('Bridge wrapper resource events contain an invalid record.')
    }
    return value as WrapperResourceEvent
  })
}

/** 缺少明确停止或删除事件时保留未知，不能用子进程退出推断 watcher 清理成功。 */
export function summarizeWrapperResources(events: WrapperResourceEvent[]): TaskResourceReport['wrapperResources'] {
  const gaps: string[] = []
  const watchers = new Map<string, WrapperResourceEvent>()
  const snapshots = new Set<string>()
  for (const event of events) {
    if (event.type === 'snapshot-created') {
      snapshots.add(event.wrapperRoot)
    }
    else if (event.type === 'snapshot-deleted') {
      if (!snapshots.delete(event.wrapperRoot)) {
        gaps.push(`A snapshot deletion has no recorded creation: ${event.wrapperRoot}.`)
      }
    }
    else if (event.type === 'watcher-started' && event.watcherId) {
      watchers.set(event.watcherId, event)
    }
    else if (event.type === 'watcher-stopped' && event.watcherId) {
      if (!watchers.delete(event.watcherId)) {
        gaps.push(`A watcher stop has no recorded start: ${event.watcherId}.`)
      }
    }
    if (event.type.endsWith('error')) {
      gaps.push(`${event.type}: ${event.error ?? 'No error detail was recorded.'}`)
    }
  }
  for (const watcher of watchers.values()) {
    gaps.push(`No explicit watcher stop was recorded for ${watcher.watcherId}.`)
  }
  for (const snapshot of snapshots) {
    gaps.push(`No snapshot deletion was recorded for ${snapshot}.`)
  }
  return { coverage: 'instrumented-bridge-wrapper-only', events, gaps }
}
