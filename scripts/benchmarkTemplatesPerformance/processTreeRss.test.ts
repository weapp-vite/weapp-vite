import { expect, it } from 'vitest'
import { sumProcessTreeRss } from './processTreeRss'

it('includes grandchildren, excludes unrelated processes and terminates on a reused-id cycle', () => {
  // 合成进程图，不依赖当前机器的进程或实际 PID。
  expect(sumProcessTreeRss(1, [
    { pid: 1, ppid: 3, rssBytes: 100 },
    { pid: 2, ppid: 1, rssBytes: 200 },
    { pid: 3, ppid: 2, rssBytes: 300 },
    { pid: 4, ppid: 0, rssBytes: 400 },
  ])).toBe(600)
  expect(sumProcessTreeRss(1, [])).toBeNull()
})
