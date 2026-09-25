import type { WatcherInstance } from '../src/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getApp } from './utils'

it.each(['classic', 'stateful-experimental'] as const)('updates sitemap owned by a Vue app with %s', async (runtime) => {
  const project = await createTempFixtureProject(getApp('weapp-vite-wevu-template'), 'app-side-json-watch')
  const compiler = await createTestCompilerContext({
    cwd: project.tempDir,
    isDev: true,
    inlineConfig: { weapp: { hmr: { runtime } }, build: { watch: { chokidar: { usePolling: true, interval: 100 } } } },
  })
  let watcher: WatcherInstance | undefined
  try {
    watcher = await compiler.ctx.buildService.build({ skipNpm: true }) as WatcherInstance
    const source = path.join(project.tempDir, 'src/sitemap.json')
    const output = path.join(project.tempDir, 'dist/sitemap.json')
    await expect.poll(() => fs.pathExists(output)).toBe(true)
    const dependencies = () => compiler.ctx.moduleGraphService.getEntryDependencies(path.join(project.tempDir, 'src/app.vue'))
    expect(dependencies()).toContainEqual({ kind: 'json', sourceId: source })
    const original = await fs.readFile(source, 'utf8')
    const originalOutput = await fs.readFile(output, 'utf8')
    for (const desc of ['sitemap-first', 'sitemap-second']) {
      await fs.writeJSON(source, { desc, rules: [{ action: 'allow', page: '*' }] })
      await expect.poll(() => fs.readFile(output, 'utf8'), { timeout: 10_000 }).toContain(desc)
      await fs.writeFile(source, original)
      await expect.poll(() => fs.readFile(output, 'utf8'), { timeout: 10_000 }).toBe(originalOutput)
    }
    const themeSource = path.join(project.tempDir, 'src/theme.json')
    expect(dependencies()).toContainEqual({ kind: 'json', sourceId: themeSource })
    await fs.writeJSON(themeSource, { light: { backgroundColor: '#123456' }, dark: {} })
    await expect.poll(() => fs.readFile(path.join(project.tempDir, 'dist/theme.json'), 'utf8'), { timeout: 10_000 }).toContain('#123456')

    const appSource = path.join(project.tempDir, 'src/app.vue')
    const app = await fs.readFile(appSource, 'utf8')
    const newSitemap = path.join(project.tempDir, 'src/next-sitemap.json')
    await fs.writeJSON(newSitemap, { desc: 'relocated', rules: [] })
    await fs.writeFile(appSource, app.replace('sitemapLocation: \'sitemap.json\'', 'sitemapLocation: \'next-sitemap.json\''))
    await expect.poll(() => dependencies(), { timeout: 10_000 }).toContainEqual({ kind: 'json', sourceId: newSitemap })
    expect(dependencies()).not.toContainEqual({ kind: 'json', sourceId: source })
    await fs.writeJSON(newSitemap, { desc: 'relocated-updated', rules: [] })
    await expect.poll(() => fs.readFile(path.join(project.tempDir, 'dist/next-sitemap.json'), 'utf8'), { timeout: 10_000 }).toContain('relocated-updated')
  }
  finally {
    await watcher?.close()
    await compiler.ctx.watcherService.closeAll()
    await compiler.dispose()
    await project.cleanup()
  }
}, 60_000)
