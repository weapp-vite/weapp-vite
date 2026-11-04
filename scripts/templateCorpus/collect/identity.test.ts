import type { CorpusSelection, CorpusTextFile } from '../types'
import type { GitTreeEntry } from './github'
import { expect, it } from 'vitest'
import { corpusHash } from '../archive'
import { confirmTemplateIdentity, identityEvidencePaths } from './identity'

function evidence(path: string, text: string): CorpusTextFile {
  return { path, text, sha256: corpusHash(text) }
}

function selection(platform: string): CorpusSelection {
  return { platform, profileId: `${platform}-xml`, extensions: ['.axml'], evidence: ['package.json'] }
}

function file(path: string): GitTreeEntry {
  return { path, type: 'blob', sha: 'a'.repeat(40) }
}

it('requires actual platform evidence rather than an extension and arbitrary package metadata', () => {
  expect(confirmTemplateIdentity(selection('alipay'), 'page.axml', '<view/>', [], [evidence('package.json', '{"name":"sample"}')]).confirmed).toBe(false)
  expect(confirmTemplateIdentity(selection('tt'), 'page.ttml', '<view tt:if="{{ok}}"/>', [], [evidence('app.json', '{"pages":["page"]}')]).confirmed).toBe(false)
  expect(confirmTemplateIdentity(selection('alipay'), 'page.axml', '<view/>', [], [evidence('package.json', '{"scripts":{"build":"taro build --type alipay"}}')]).confirmed).toBe(true)
})

it('does not confuse shared template formats from multiple explicitly declared targets', () => {
  const declared = [evidence('README.md', '支付宝小程序、钉钉小程序'), evidence('package.json', '{"scripts":{"build":"taro build --type alipay"}}')]
  expect(confirmTemplateIdentity(selection('alipay'), 'page.axml', '<view a:if="{{ok}}"/>', [], declared).confirmed).toBe(false)
  expect(confirmTemplateIdentity(selection('alipay'), 'alipay/page.axml', '<view a:if="{{ok}}"/>', [], declared).confirmed).toBe(true)
  const lark = [evidence('project.config.json', '{"appid":"cli_a123"}')]
  expect(confirmTemplateIdentity(selection('lark'), 'page.ttml', '<view/>', [], lark).confirmed).toBe(true)
  expect(confirmTemplateIdentity(selection('tt'), 'page.ttml', '<view/>', [], lark).confirmed).toBe(false)
})

it('rejects Qt QML despite QQ documentation when the file is not mini-program markup', () => {
  const readme = [evidence('README.md', 'QQ 小程序工具与 Qt 示例')]
  expect(confirmTemplateIdentity(selection('qq'), 'main.qml', 'import QtQuick 2.0\nRectangle { width: 10 }', [], readme).confirmed).toBe(false)
  expect(confirmTemplateIdentity(selection('qq'), 'page.qml', '<view qq:if="{{ok}}"/>', [], readme).confirmed).toBe(true)
})

it('accepts native WeChat structure and records the exact evidence that confirmed it', () => {
  const configuration = [evidence('app.json', '{"pages":["page"]}')]
  const decision = confirmTemplateIdentity(selection('weapp'), 'page.wxml', '<view/>', [file('page.wxss')], configuration)
  expect(decision.confirmed).toBe(true)
  expect(decision.evidence).toContain('platform-style-sidecar:.wxss')
  expect(confirmTemplateIdentity(selection('weapp'), 'page.wxml', 'plain text', [], configuration).confirmed).toBe(false)
})

it('bounds evidence reads and gives actual project files priority over arbitrary nested metadata', () => {
  const selected = [{ ...selection('tt'), evidence: Array.from({ length: 30 }, (_, index) => `examples/${index}/package.json`) }]
  const files = [...selected[0]!.evidence.map(file), file('project.tt.json'), file('README.md'), file('ignored.ts')]
  const paths = identityEvidencePaths(selected, files)
  expect(paths).toHaveLength(16)
  expect(paths.slice(0, 2)).toEqual(['project.tt.json', 'README.md'])
  expect(paths).not.toContain('ignored.ts')
})

it('keeps empty, comment-only and text-only templates once the project platform is independently confirmed', () => {
  for (const source of ['', '<!-- no visible elements -->', 'plain template text']) {
    const alipay = [evidence('package.json', '{"scripts":{"build":"taro build --type alipay"}}')]
    expect(confirmTemplateIdentity(selection('alipay'), 'page.axml', source, [], alipay).confirmed).toBe(true)
    expect(confirmTemplateIdentity(selection('weapp'), 'page.wxml', source, [], [evidence('project.config.json', '{"appid":"wx123abc"}')]).confirmed).toBe(true)
    const qq = [evidence('project.qq.json', '{}'), evidence('app.json', '{"pages":["page"]}')]
    expect(confirmTemplateIdentity(selection('qq'), 'page.qml', source, [file('page.js')], qq).confirmed).toBe(true)
    expect(confirmTemplateIdentity(selection('qq'), 'page.qml', source, [], qq).confirmed).toBe(false)
  }
})
