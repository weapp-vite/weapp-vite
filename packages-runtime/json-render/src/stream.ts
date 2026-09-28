import type { RendererCatalog, RendererLimits, RendererSpec } from './types'
import { createSpecStreamCompiler } from './core'
import { cloneJson, parsePointer } from './path'
import { validateRendererSpec } from './validation'

/** 按批应用描述 Patch，保留上一次完整界面并等待暂缺的节点引用。 */
export function createSpecStream(initial: RendererSpec, catalog: RendererCatalog, state: object, limits: RendererLimits = {}) {
  let candidate = cloneJson(initial)
  let buffer = ''
  let stopped = false
  const maxBufferedCharacters = limits.maxBufferedCharacters ?? 65_536
  if (!Number.isInteger(maxBufferedCharacters) || maxBufferedCharacters < 1) {
    throw new Error('流缓冲上限必须是正整数')
  }
  return {
    push(chunk: string, done = false): RendererSpec | null {
      if (stopped) {
        throw new Error('流已停止，请创建新的流')
      }
      try {
        buffer += chunk
        if (buffer.length > maxBufferedCharacters) {
          throw new Error('单批流数据过大')
        }
        const lines = buffer.split('\n')
        buffer = done ? '' : lines.pop()!
        let draft = cloneJson(candidate)
        let changed = false
        for (const line of lines) {
          if (!line.trim()) {
            continue
          }
          const patch = JSON.parse(line) as Record<string, unknown>
          if (!patch || !['add', 'replace', 'remove'].includes(String(patch.op)) || typeof patch.path !== 'string'
            || !/^\/(?:root|elements)(?:\/|$)/.test(patch.path)
            || Object.keys(patch).some(key => !['op', 'path', 'value'].includes(key))
            || (patch.op !== 'remove' && !Object.prototype.hasOwnProperty.call(patch, 'value'))) {
            throw new Error('不支持的 Patch，只允许更新 root/elements')
          }
          parsePointer(patch.path)
          // 每行独立编译，避免上游按文本去重吞掉合法的重复数组操作。
          draft = createSpecStreamCompiler<RendererSpec>(draft).push(`${line}\n`).result
          changed = true
        }
        const checked = validateRendererSpec(draft, catalog, state, limits, !done)
        candidate = checked.spec
        stopped = done
        return checked.complete && changed ? checked.spec : null
      }
      catch (error) {
        stopped = true
        throw error
      }
    },
    dispose() {
      stopped = true
      buffer = ''
    },
  }
}
