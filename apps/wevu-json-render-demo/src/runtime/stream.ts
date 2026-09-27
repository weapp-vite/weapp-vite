import type { DemoSpec } from './schema'
import { createSpecStreamCompiler } from './core'
import { validateSpec } from './schema'

/** 每批事务化应用 Patch，Core 的可变结果不与已提交的界面共享对象。 */
export function createDemoStream(initial: DemoSpec) {
  let candidate: DemoSpec = JSON.parse(JSON.stringify(initial))
  let buffer = ''
  let failed = false
  return {
    push(chunk: string, done = false): DemoSpec | null {
      if (failed) {
        throw new Error('流已停止，请重新播放')
      }
      try {
        buffer += chunk
        if (buffer.length > 65_536) {
          throw new Error('单批流数据过大')
        }
        const lines = buffer.split('\n')
        buffer = done ? '' : lines.pop()!
        let draft: DemoSpec = JSON.parse(JSON.stringify(candidate))
        let changed = false
        for (const line of lines) {
          if (!line.trim()) {
            continue
          }
          const patch = JSON.parse(line) as Record<string, unknown>
          if (!['add', 'replace', 'remove'].includes(String(patch.op)) || typeof patch.path !== 'string'
            || !/^\/(?:root|elements)(?:\/|$)/.test(patch.path)
            || patch.path.split('/').some(part => ['__proto__', 'constructor', 'prototype'].includes(part))
            || Object.keys(patch).some(key => !['op', 'path', 'value'].includes(key))
            || (patch.op !== 'remove' && !Object.hasOwn(patch, 'value'))) {
            throw new Error('不支持的 Patch，只允许更新 root/elements')
          }
          // 每行使用新的编译器，避免上游按文本去重吞掉合法的重复数组操作。
          const compiler = createSpecStreamCompiler<DemoSpec>(draft)
          draft = compiler.push(`${line}\n`).result
          changed = true
        }
        const checked = validateSpec(draft, !done)
        candidate = checked.spec
        return checked.complete && changed ? checked.spec : null
      }
      catch (error) {
        failed = true
        throw error
      }
    },
  }
}
