import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-vue-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: wevu-vue-demo (template compat)', () => {
  it('compiles tuple/object destructuring, object-map v-for and array mutations', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/vue-compat/template/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/vue-compat/template/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('wx:for="{{entries}}"')
    const itemVarMatch = pageWxml.match(/wx:for-item="(__wv_item_\d+)"/)
    expect(itemVarMatch).not.toBeNull()
    const itemVar = itemVarMatch?.[1] ?? '__wv_item_0'
    expect(pageWxml).toContain(`{{${itemVar}[0]}}`)
    expect(pageWxml).toContain(`{{${itemVar}[1]}}`)

    const objectPatternMatch = pageWxml.match(/wx:for="\{\{entryObjects\}\}"[^>]*wx:for-item="(__wv_item_\d+)"/)
    expect(objectPatternMatch).not.toBeNull()
    const objectItemVar = objectPatternMatch?.[1] ?? '__wv_item_1'
    expect(pageWxml).toContain(`{{${objectItemVar}.key}}`)
    expect(pageWxml).toContain(`{{${objectItemVar}.value}}`)

    expect(pageWxml).toContain('wx:for="{{summaryMap}}"')
    expect(pageWxml).toContain('wx:for-item="value"')
    expect(pageWxml).toContain('wx:for-index="key"')
    expect(pageWxml).toContain('{{key}} = {{value}}')
    expect(pageWxml).toContain('动态数组变更（新增 / 删除 / 修改）')
    expect(pageWxml).toContain('新增一项')
    expect(pageWxml).toContain('删除最后一项')
    expect(pageWxml).toContain('修改首项 value')
    expect(pageWxml).toContain('{{entries.length}}')
    expect(pageWxml).toContain('{{entryObjects.length}}')
    expect(pageWxml).toMatch(/wx:elif="\{\{mode\s*===\s*['"]done['"]\s*\|\|\s*mode\s*===\s*['"]todo['"]\}\}"/)
    expect(pageWxml).toContain('v-else-if 分支')

    expect(pageJs).toContain('entries')
    expect(pageJs).toContain('entryObjects')
    expect(pageJs).toContain('summaryMap')
    expect(pageJs).toContain('Object.fromEntries')
    expect(pageJs).toContain('dynamic-')
  })
})
