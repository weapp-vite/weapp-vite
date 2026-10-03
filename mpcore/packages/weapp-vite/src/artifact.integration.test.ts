import type { WeappViteTestArtifactWatcher } from './index'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createTestProject } from '@mpcore/test'
import { expect, it } from 'vitest'
import { isTestArtifactCurrent } from 'weapp-vite/test'
import { buildWeappViteTestArtifact, clearWeappViteTestArtifactCache, watchWeappViteTestArtifact } from './index'

async function createFixture() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-test-artifact-'))
  await fs.mkdir(path.join(cwd, 'src/pages/home'), { recursive: true })
  await fs.mkdir(path.join(cwd, 'node_modules'))
  const packageRoot = await fs.realpath(path.resolve(import.meta.dirname, '../../../../packages/weapp-vite'))
  await fs.symlink(packageRoot, path.join(cwd, 'node_modules/weapp-vite'), 'junction')
  const files = {
    'package.json': JSON.stringify({ type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', miniprogramRoot: 'dist/', compileType: 'miniprogram' }),
    'settings.ts': 'export default "alpha"',
    'shared.ts': 'export default "first"',
    'external.json': '"external-first"',
    'vite.config.ts': `import { defineConfig } from 'weapp-vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import label from './settings'
export default defineConfig({
  weapp: { srcRoot: 'src' }, define: { __LABEL__: JSON.stringify(label) },
  plugins: [{
    name: 'third-party-external-input',
    resolveId(id) { if (id === 'virtual:artifact-data') return '\\0artifact-data' },
    load: { order: 'pre', handler: async function(id) {
      if (id !== '\\0artifact-data') return
      const file = path.resolve(import.meta.dirname, 'external.json')
      this.addWatchFile(file)
      return 'export default ' + await fs.readFile(file, 'utf8')
    } },
  }],
})`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': `import value from '../../../shared'
import external from 'virtual:artifact-data'
Page({ data: { label: __LABEL__, value, external, count: 0 }, tap() { this.setData({ count: this.data.count + 1 }) } })`,
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{label}} {{value}}</view><view>{{external}}</view><button bindtap="tap">{{count}}</button>',
  }
  await Promise.all(Object.entries(files).map(([file, content]) => fs.writeFile(path.join(cwd, file), content)))
  return cwd
}

it('invalidates changed inputs and missing outputs without overwriting a running test generation', async () => {
  const cwd = await createFixture()
  const options = { cwd, skipNpm: true }
  try {
    const first = await buildWeappViteTestArtifact(options)
    expect(await isTestArtifactCurrent(first)).toBe(true)
    expect(await buildWeappViteTestArtifact(options)).toBe(first)
    await fs.writeFile(path.join(cwd, 'external.json'), '"external-after"')
    expect(await isTestArtifactCurrent(first)).toBe(false)
    const old = createTestProject({ artifact: first })
    try {
      const oldPage = await old.renderPage('/pages/home/index')
      expect(oldPage.screen.getByText('alpha first')).toBeDefined()
      await fs.writeFile(path.join(cwd, 'shared.ts'), 'export default "later"')
      expect(await isTestArtifactCurrent(first)).toBe(false)
      const updated = await buildWeappViteTestArtifact(options)
      expect(updated.miniprogramRootPath).not.toBe(first.miniprogramRootPath)
      const fresh = createTestProject({ artifact: updated })
      try {
        const page = await fresh.renderPage('/pages/home/index')
        expect(page.screen.getByText('alpha later')).toBeDefined()
        await oldPage.user.tap(oldPage.screen.getByRole('button'))
        expect(oldPage.screen.getByText('1')).toBeDefined()
        expect(oldPage.screen.getByText('alpha first')).toBeDefined()
      }
      finally {
        await fresh.close()
      }
      await fs.rm(path.join(updated.miniprogramRootPath, 'pages/home/index.js'))
      expect(await isTestArtifactCurrent(updated)).toBe(false)
      const repaired = await buildWeappViteTestArtifact(options)
      await expect(fs.access(path.join(repaired.miniprogramRootPath, 'pages/home/index.js'))).resolves.toBeUndefined()
    }
    finally {
      await old.close()
    }
  }
  finally {
    clearWeappViteTestArtifactCache(options)
    await fs.rm(cwd, { recursive: true, force: true })
  }
}, 60_000)

it('watches configuration, script and plugin-only dependencies outside the source root', async () => {
  const cwd = await createFixture()
  let watcher: WeappViteTestArtifactWatcher | undefined
  let rebuilt: (() => void) | undefined
  let failed: ((error: unknown) => void) | undefined
  try {
    watcher = await watchWeappViteTestArtifact({
      cwd,
      skipNpm: true,
      onRebuilt() { rebuilt?.() },
      onError(error) { failed?.(error) },
    })
    for (const [file, content, text] of [
      ['settings.ts', 'export default "bravo"', 'bravo first'],
      ['shared.ts', 'export default "after"', 'bravo after'],
      ['external.json', '"external-later"', 'external-later'],
    ] as const) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      const completed = new Promise<void>((resolve, reject) => {
        rebuilt = resolve
        failed = reject
        timeout = setTimeout(() => reject(new Error(`Artifact did not rebuild after ${file}`)), 25_000)
      })
      try {
        await fs.writeFile(path.join(cwd, file), content)
        await completed
      }
      finally {
        clearTimeout(timeout)
      }
      const project = createTestProject({ artifact: watcher.artifact })
      try {
        const page = await project.renderPage('/pages/home/index')
        expect(page.screen.getByText(text)).toBeDefined()
      }
      finally {
        await project.close()
      }
    }
  }
  finally {
    await watcher?.close()
    clearWeappViteTestArtifactCache({ cwd, skipNpm: true })
    await fs.rm(cwd, { recursive: true, force: true })
  }
}, 60_000)
