import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1034Project, runIssue1034Command } from '../utils/issue1034Project'

const projects: string[] = []
afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

describe('issue #1034: selected auto route sources', () => {
  it('selects Vue pages and preserves explicitly imported sibling scripts in all packages', async () => {
    const project = await createIssue1034Project()
    projects.push(project)
    await runIssue1034Command(project, 'build')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as {
      pages: string[]
      subPackages: Array<{ root: string, pages: string[], independent?: boolean }>
    }
    expect(app.pages).toEqual(['pages/home/index'])
    expect(app.subPackages).toEqual(expect.arrayContaining([
      expect.objectContaining({ root: 'subpackages/account', pages: ['pages/detail/index'] }),
      expect.objectContaining({ root: 'subpackages/isolated', pages: ['pages/detail/index'], independent: true }),
    ]))
    for (const [index, route] of ['pages/home/index', 'subpackages/account/pages/detail/index', 'subpackages/isolated/pages/detail/index'].entries()) {
      const output = path.join(project, 'dist', route)
      expect(await readFile(`${output}.wxml`, 'utf8')).toContain('id="source"')
      expect(await readFile(`${output}.js`, 'utf8')).toContain(`business-${index}`)
      expect(JSON.parse(await readFile(`${output}.json`, 'utf8'))).toMatchObject({ navigationBarTitleText: `page${index}` })
    }
    const outputs = await readdir(path.join(project, 'dist'), { recursive: true })
    const mainScripts = await Promise.all(outputs.filter(file => file.endsWith('.js') && !file.replaceAll('\\', '/').startsWith('subpackages/'))
      .map(file => readFile(path.join(project, 'dist', file), 'utf8')))
    expect(mainScripts.join('\n')).not.toContain('business-1')
    expect(mainScripts.join('\n')).not.toContain('business-2')
    for (const scope of ['main', 'isolated']) {
      const evidence = JSON.parse(await readFile(path.join(project, `dist/issue-1034-${scope}-modules.json`), 'utf8')) as { modules: Array<{ id: string, chunks: string[] }> }
      const base = scope === 'main' ? 'subpackages/account/pages/detail/index' : 'subpackages/isolated/pages/detail/index'
      for (const extension of ['vue', 'js']) {
        const module = evidence.modules.find(module => module.id === `${base}.${extension}`)
        expect(module).toBeDefined()
        expect(module!.chunks.length).toBeGreaterThan(0)
        expect(module!.chunks.every(chunk => chunk.startsWith(base.split('/pages/')[0]!))).toBe(true)
      }
    }
    const types = await readFile(path.join(project, '.weapp-vite/typed-router.d.ts'), 'utf8')
    expect(types).toContain('route0')
    expect(types).toContain('route1')
    expect(types).toContain('route2')
    expect(types).not.toContain('pages/excluded/index')
  })

  it.each(['classic', 'stateful-experimental'] as const)('keeps %s route selection through sibling edits, deletion and recovery', async (engine) => {
    const project = await createIssue1034Project()
    projects.push(project)
    const configFile = path.join(project, 'weapp-vite.config.ts')
    await writeFile(configFile, (await readFile(configFile, 'utf8')).replace('srcRoot: \'src\',', `srcRoot: 'src', hmr: { runtime: '${engine}' },`))
    const root = path.resolve(import.meta.dirname, '../..')
    const dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], {
      cwd: root,
      env: createDevProcessEnv(),
      all: true,
    })
    const selected = path.join(project, 'src/subpackages/account/pages/detail/index.vue')
    const source = await readFile(selected, 'utf8')
    const appRoutes = async () => {
      const config = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { subPackages?: Array<{ root: string, pages: string[] }> }
      return config.subPackages?.find(pkg => pkg.root === 'subpackages/account')?.pages ?? []
    }
    const declaration = () => readFile(path.join(project, '.weapp-vite/typed-router.d.ts'), 'utf8')
    const scripts = async () => {
      const out = path.join(project, 'dist')
      const files = await readdir(out, { recursive: true })
      return (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(path.join(out, file), 'utf8')))).join('\n')
    }
    try {
      await dev.waitForInitialBuild()
      await dev.waitForOutput('开发服务已就绪', 'watcher is ready')
      // 轮询 watcher 必须先建立初始文件快照，再写入首个变更。
      await delay(1_000)
      await dev.waitFor(expect.poll(scripts, { timeout: 90_000 }).toContain('business-1'), 'initial selected source')
      if (engine === 'classic') {
        await writeFile(selected.replace('.vue', '.js'), 'export const label = \'business-updated\'\n')
        await dev.waitFor(expect.poll(scripts, { timeout: 60_000 }).toContain('business-updated'), 'explicit sibling import updates')
      }
      // stateful 只向已加载模块的客户端交付脚本补丁；对应真实交付在 runtime suite 验收。
      expect(await declaration()).toContain('route1')
      await rm(selected)
      await dev.waitFor(expect.poll(declaration, { timeout: 60_000 }).not.toContain('route1'), 'removed selected page is not replaced by sibling')
      await dev.waitFor(expect.poll(appRoutes, { timeout: 60_000 }).not.toContain('pages/detail/index'), 'removed page is unpublished')
      await writeFile(selected, source.replace('name: \'route1\'', 'name: \'restored\''))
      await dev.waitFor(expect.poll(declaration, { timeout: 60_000 }).toContain('restored'), 'restored source updates route types')
      await dev.waitFor(expect.poll(appRoutes, { timeout: 60_000 }).toContain('pages/detail/index'), 'restored page is published')
      await dev.waitFor(expect.poll(() => readFile(path.join(project, 'dist/subpackages/account/pages/detail/index.wxml'), 'utf8'), { timeout: 60_000 }).toContain('id="source"'), 'restored page template')
      await dev.waitFor(expect.poll(scripts, { timeout: 60_000 }).toContain(engine === 'classic' ? 'business-updated' : 'business-1'), 'restored snapshot preserves explicit sibling import')
      await writeFile(path.join(project, 'src/pages/excluded/index.js'), 'Page({ data: { source: \'still-excluded\' } })\n')
      expect(await declaration()).not.toContain('pages/excluded/index')
    }
    finally {
      await dev.stop(5_000)
    }
  }, 300_000)
})
