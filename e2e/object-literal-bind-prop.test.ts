import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/object-literal-bind-prop')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

describe.sequential('e2e app: object-literal-bind-prop', () => {
  it('compiles component object literal prop binding to runtime variable', async () => {
    await fs.remove(DIST_ROOT)

    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      stdio: 'inherit',
      cwd: APP_ROOT,
    })

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/InfoBanner/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('root="{{__wv_bind_0}}"')
    expect(pageWxml).toContain('extra="{{__wv_bind_1}}"')
    expect(pageWxml).toContain('__wvAttrs="{{[\'root\',__wv_bind_0,\'extra\',__wv_bind_1]}}"')
    expect(pageWxml).not.toContain('root="{{{')
    expect(pageWxml).not.toContain('root="{{({')

    expect(pageJs).toContain('__wv_bind_0')
    expect(pageJs).toContain('return{a:`aaaa`}')
    expect(pageJs).toContain('return{tag:`ok`}')

    expect(componentWxml.replace(/\s+/g, '')).toContain('{{root.a}}-{{attrs.extra?.tag||\'\'}}')
  })
})
