import path from 'node:path'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

async function waitForAsset(file: string, expected: string) {
  const end = Date.now() + 30_000
  while (Date.now() < end) {
    if (await fs.readFile(file, 'utf8').catch(() => undefined) === expected) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Asset did not receive expected bytes: ${path.basename(file)}`)
}

describe('copied asset watch ownership', { concurrent: false }, () => {
  it.each(['classic', 'stateful-experimental'])('updates copied assets with auto import disabled in %s', async (runtime) => {
    const tempRoot = path.join(ROOT, '.tmp')
    await fs.ensureDir(tempRoot)
    const app = await fs.mkdtemp(path.join(tempRoot, 'asset-watch-'))
    const project = await fs.readJSON(path.join(ROOT, 'e2e-apps/stateful-hmr/project.config.json')) as Record<string, unknown>
    const sources: Record<string, string> = {
      'package.json': JSON.stringify({ name: 'asset-watch-fixture', type: 'module' }),
      'project.config.json': JSON.stringify({ ...project, miniprogramRoot: 'dist/' }),
      'weapp-vite.config.ts': `export default {
        weapp: {
          srcRoot: 'src', autoImportComponents: false, hmr: { runtime: ${JSON.stringify(runtime)} },
          copy: { include: ['**/*.txt'], exclude: ['**/excluded.txt'], filter: file => !file.endsWith('filtered.txt') },
        },
        publicDir: 'public',
      }`,
      'src/app.js': 'App({});',
      'src/app.json': JSON.stringify({ pages: ['pages/index'] }),
      'src/pages/index.js': 'Page({ data: { count: 1 } });',
      'src/pages/index.wxml': '<view>{{count}}</view>',
      'src/resources/copied.png': 'image-original-bytes',
      'src/resources/copied.txt': 'text-original-bytes',
      'src/resources/excluded.txt': 'excluded-original-bytes',
      'src/resources/filtered.txt': 'filtered-original-bytes',
      'public/public.txt': 'public-original-bytes',
    }
    for (const [file, content] of Object.entries(sources)) {
      await fs.outputFile(path.join(app, file), content)
    }
    const dev = startDevProcess(process.execPath, [CLI, 'dev', app, '--platform', 'weapp', '--skipNpm'], {
      all: true,
      cwd: app,
      env: createDevProcessEnv(),
      reject: false,
    })
    try {
      await dev.waitForInitialBuild(60_000)
      for (const name of ['copied.png', 'copied.txt']) {
        const source = path.join(app, 'src/resources', name)
        const output = path.join(app, 'dist/resources', name)
        const original = sources[`src/resources/${name}`]!
        await dev.waitFor(waitForAsset(output, original), 'initial copied asset')
        for (const content of ['edit-one', original, 'edit-two', original]) {
          await replaceFileByRename(source, content)
          await dev.waitFor(waitForAsset(output, content), 'copied asset edit or complete restoration')
        }
      }
      const added = path.join(app, 'src/resources/nested/new.txt')
      await fs.outputFile(added, 'created bytes')
      await dev.waitFor(waitForAsset(path.join(app, 'dist/resources/nested/new.txt'), 'created bytes'), 'new copied asset')
      await replaceFileByRename(added, 'updated bytes')
      await dev.waitFor(waitForAsset(path.join(app, 'dist/resources/nested/new.txt'), 'updated bytes'), 'new asset subsequent update')
      await expect(fs.pathExists(path.join(app, 'dist/resources/excluded.txt'))).resolves.toBe(false)
      await expect(fs.pathExists(path.join(app, 'dist/resources/filtered.txt'))).resolves.toBe(false)
      await expect(fs.readFile(path.join(app, 'dist/public.txt'), 'utf8')).resolves.toBe('public-original-bytes')
      expect(dev.getOutput()).not.toMatch(/Build failed|Build error|snapshot refresh failed|asset watcher failed/)
    }
    finally {
      await dev.stop(5_000)
      await fs.remove(app)
    }
  })
})
