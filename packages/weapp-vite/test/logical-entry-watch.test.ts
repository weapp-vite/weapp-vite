import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { parseLogicalEntryId } from '../src/moduleGraph/protocol'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

it('keeps the logical wrapper stable when only its physical script changes', async () => {
  const project = await createTempFixtureProject(getFixture('wxml-remove'), 'logical-entry-watch')
  const source = path.join(project.tempDir, 'src/pages/native/index.js')
  const codes: string[] = []
  const compiler = await createTestCompilerContext({
    cwd: project.tempDir,
    mode: 'transform',
    isDev: true,
    inlineConfig: {
      weapp: { hmr: { runtime: 'stateful-experimental' } },
      build: { watch: { chokidar: { usePolling: true, interval: 100 } } },
      plugins: [{
        name: 'logical-entry-code-contract',
        enforce: 'post',
        transform(code, id) {
          if (parseLogicalEntryId(id)?.sourceId === source) {
            codes.push(code)
          }
        },
      }],
    },
  })
  let watcher: WatcherInstance | undefined
  try {
    watcher = await compiler.ctx.buildService.build({ skipNpm: true }) as WatcherInstance
    const original = await fs.readFile(source, 'utf8')
    expect(codes.length).toBeGreaterThan(0)
    for (const content of [`${original}\nconsole.log("logical-owner-edit");\n`, original]) {
      const count = codes.length
      await fs.writeFile(source, content)
      await expect.poll(() => codes.length, { timeout: 10_000 }).toBeGreaterThan(count)
      expect(new Set(codes).size).toBe(1)
    }
  }
  finally {
    await watcher?.close()
    await compiler.ctx.watcherService.closeAll()
    await compiler.dispose()
    await project.cleanup()
  }
}, 60_000)
