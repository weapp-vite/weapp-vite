import { expect, it } from 'vitest'
import { decodeCorpusSource, isAttributionFile } from './attribution'

it('preserves standard license and notice names without matching unrelated component assets', () => {
  for (const file of ['LICENSE', 'LICENCE', 'LICENSE.md', 'COPYING.txt', 'NOTICE', 'NOTICE.txt', 'licenses/LICENSE-MIT', 'LICENSE.Apache-2.0', 'LICENSE.zh-CN.md', 'COPYING.GPL-3.0', 'admin/LICENSE2.txt', 'COPYING3', 'LICENSE-2.md', 'COPYING_3.txt']) {
    expect(isAttributionFile(file), file).toBe(true)
  }
  for (const file of ['notice.png', 'notice-bar.vue', 'notice_bar.js', 'notice.json', 'notice.md.png', 'LICENSE-template.ts', 'assets/COPYING.svg']) {
    expect(isAttributionFile(file), file).toBe(false)
  }
})

it('identifies a failed source decode without substituting replacement characters', () => {
  expect(() => decodeCorpusSource(Uint8Array.from([0xA3, 0xBA]), 'example/templates@commit:page.wxml')).toThrow('example/templates@commit:page.wxml')
})
