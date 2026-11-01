import { fs } from '@weapp-core/shared/fs'
import { applyEdits, modify } from 'jsonc-parser'

/** 仅更新变化的 JSON 值，保留发布阶段已经校准的数组、缩进和换行。 */
export async function updatePreparedJson(file: string, value: Record<string, unknown>) {
  let content = await fs.readFile(file, 'utf8')
  const current = JSON.parse(content) as Record<string, unknown>
  function update(before: unknown, after: unknown, segments: Array<string | number>) {
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return
    }
    if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
      const left = before as Record<string, unknown>
      const right = after as Record<string, unknown>
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        update(left[key], right[key], [...segments, key])
      }
      return
    }
    content = applyEdits(content, modify(content, segments, after, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    }))
  }
  update(current, value, [])
  await fs.writeFile(file, content)
}
