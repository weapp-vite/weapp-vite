/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 构建。 */
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/object-literal-bind-prop')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

describe.sequential('e2e app: object-literal-bind-prop', () => {
  it('compiles static component object literal prop binding to IDE-safe inline mustache', async () => {
    await fs.remove(DIST_ROOT)

    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      stdio: 'inherit',
      cwd: APP_ROOT,
    })

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('root="{{ { a: \'aaaa\' } }}"')
    expect(pageWxml).not.toContain('root="{{{')
    expect(pageWxml).not.toContain('root="{{({')
    expect(pageWxml).not.toMatch(/root="\{\{__wv_bind_\d+\}\}"/)

    expect(pageJs).not.toMatch(/__wv_bind_\d+\s*=\s*\(\s*\(\)\s*=>\s*\(\{\s*a:\s*['"`]aaaa['"`]\s*\}\)\s*\)/)
    expect(pageJs).not.toMatch(/return\s*\{\s*a:\s*['"`]aaaa['"`]\s*\}/)
  })
})
