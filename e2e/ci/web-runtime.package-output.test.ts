/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动包构建。 */
import { fs } from '@weapp-core/shared'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const WEB_PACKAGE_ROOT = path.join(REPO_ROOT, 'packages-runtime/web')
const DIST_ROOT = path.join(WEB_PACKAGE_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('pnpm', ['--filter', '@weapp-vite/web', 'build'], {
    cwd: REPO_ROOT,
  })
}

describe.sequential('e2e package: @weapp-vite/web (build output)', () => {
  it('issue #456: keeps entry output readable and emits sourcemaps', async () => {
    await runBuild()

    const indexEntryPath = path.join(DIST_ROOT, 'index.mjs')
    const runtimeEntryPath = path.join(DIST_ROOT, 'runtime/index.mjs')

    expect(await fs.pathExists(indexEntryPath)).toBe(true)
    expect(await fs.pathExists(runtimeEntryPath)).toBe(true)

    const indexEntry = await fs.readFile(indexEntryPath, 'utf8')
    const runtimeEntry = await fs.readFile(runtimeEntryPath, 'utf8')

    expect(indexEntry).toContain('from "./runtime/style.mjs"')
    expect(indexEntry).not.toMatch(/from "\.\/runtime-[^"]+\.mjs"/)
    expect(indexEntry).not.toMatch(/from "\.\/plugin-[^"]+\.mjs"/)
    expect(indexEntry.split('\n').length).toBeGreaterThan(10)

    expect(runtimeEntry).toContain('from "./style.mjs"')
    expect(runtimeEntry).not.toMatch(/from "\.\.\/runtime-[^"]+\.mjs"/)
    expect(runtimeEntry.split('\n').length).toBeGreaterThan(10)

    expect(await fs.pathExists(path.join(DIST_ROOT, 'runtime/polyfill/index.mjs.map'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'plugin/index.mjs.map'))).toBe(true)
  })
})
