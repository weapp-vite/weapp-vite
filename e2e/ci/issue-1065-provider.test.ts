import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { fakeProvider } from '../../e2e-apps/github-issues/fixtures/issue-1065/fakeProvider'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createIssue1065Project, runIssue1065Command } from '../utils/issue1065Project'
import { runWithCleanup } from '../utils/runWithCleanup'

it('shares the complete stylesheet contract between formal output and frozen HMR preparation', async () => {
  const project = await createIssue1065Project()
  try {
    const srcRoot = path.join(project, 'src')
    const stylesheet = path.join(srcRoot, 'pages/home/index.css')
    const tokens = path.join(srcRoot, 'provider.tokens.json')
    const readSource = vi.fn((id: string) => readFile(id, 'utf8'))
    const controller = await fakeProvider().create({
      root: project,
      srcRoot,
      platform: 'weapp',
      outputExtensions: { js: 'js', json: 'json', wxml: 'wxml', wxss: 'wxss' },
      isDev: true,
      readFile: readSource,
      resolve: async () => null,
      addWatchFile: vi.fn(),
      invalidate: vi.fn(),
      warn: vi.fn(),
      error: (message) => { throw new Error(message) },
      claimSource: vi.fn(),
      getSourceOwner: () => undefined,
    })
    const sources = new Map([
      [stylesheet.replaceAll('\\', '/'), await readSource(stylesheet)],
      [tokens.replaceAll('\\', '/'), await readSource(tokens)],
    ])
    const formal = await controller.transformCss!({
      fileName: 'pages/home/index.wxss',
      code: '.provider-page { color: #ff0000;\n}\n\n',
    })
    expect(formal?.dependencies).toEqual([tokens, stylesheet])
    expect(formal?.code).toContain('.provider-finalized { opacity: 1; }')
    const readsBeforePreparation = readSource.mock.calls.length
    await writeFile(tokens, JSON.stringify({ color: '#00ff00' }))
    const prepare = (revision: number, changedFile = path.join(srcRoot, 'pages/home/label.ts')) => controller.prepareHmr!({
      revision,
      changedFiles: [changedFile],
      sources,
    })
    const prepared = await prepare(1)
    expect(prepared.assets).toEqual([{ fileName: 'pages/home/index.wxss', code: formal?.code }])
    expect(readSource).toHaveBeenCalledTimes(readsBeforePreparation)
    sources.set(tokens.replaceAll('\\', '/'), JSON.stringify({ color: '#0000ff' }))
    const changed = await prepare(2, tokens)
    expect(changed.assets?.[0]?.code).toContain('#0000ff')
    expect(changed.assets?.[0]?.code).toContain('provider-finalized')
    expect(changed.assets?.[0]?.code).not.toBe(formal?.code)
    expect(prepared.assets?.[0]?.code).toBe(formal?.code)
    expect(readSource).toHaveBeenCalledTimes(readsBeforePreparation)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})

it('consumes a third-party provider through CLI source, output, bundle and lifecycle hooks', async () => {
  const project = await createIssue1065Project()
  try {
    await runIssue1065Command(project, 'build')
    const read = (name: string) => readFile(path.join(project, 'dist', name), 'utf8')
    expect(await read('app.wxss')).toContain('#123456')
    expect(await read('pages/home/index.wxss')).toContain('#ff0000')
    expect(await read('pages/home/index.wxss')).toContain('provider-finalized')
    expect(await read('pages/home/index.wxml')).toContain('template-after')
    expect(await read('pages/home/index.js')).toContain('script-after')
    const events = (await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')).trim().split('\n').map(line => (JSON.parse(line) as { event: string }).event)
    expect(events).toEqual(expect.arrayContaining(['source', 'css', 'template', 'script', 'finalize', 'buildStart', 'closeBundle']))
    expect(events.filter(event => event === 'dispose')).toHaveLength(1)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)

it('rejects two providers claiming the same CSS source through CLI', async () => {
  const project = await createIssue1065Project()
  try {
    const filename = path.join(project, 'weapp-vite.config.ts')
    await writeFile(filename, (await readFile(filename, 'utf8')).replace('fakeProvider()]', 'fakeProvider(), fakeProvider(\'conflicting-provider\')]'))
    await expect(runIssue1065Command(project, 'build')).rejects.toThrow('所有权冲突')
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 60_000)

it('watches provider dependencies across consecutive CLI updates', async () => {
  const project = await createIssue1065Project()
  const root = path.resolve(import.meta.dirname, '../..')
  const dev = startDevProcess(process.execPath, [path.join(root, 'packages/weapp-vite/bin/weapp-vite.js'), 'dev', project, '--skipNpm'], { cwd: root, env: createDevProcessEnv(), all: true, ipc: true })
  await runWithCleanup(async () => {
    await dev.waitForInitialBuild()
    await dev.waitForOutput('开发服务已就绪', 'watcher is ready')
    const readEvents = () => readFile(path.join(project, 'provider-events.jsonl'), 'utf8')
    const watchedDependencies = async () => (await readEvents()).split('watch:provider.tokens.json').length - 1
    for (const color of ['#0000ff', '#00ff00', '#ff0000']) {
      const previous = await watchedDependencies()
      await writeFile(path.join(project, 'src/provider.tokens.json'), JSON.stringify({ color }))
      await dev.waitFor(expect.poll(watchedDependencies, { timeout: 30_000 }).toBeGreaterThan(previous), 'provider dependency watch notification')
      await dev.waitFor(expect.poll(() => readFile(path.join(project, 'dist/pages/home/index.wxss'), 'utf8'), { timeout: 30_000 }).toContain(color), 'provider dependency rebuild')
    }
    const events = await readEvents()
    expect(events).toContain('watch:provider.tokens.json')
    expect(events).not.toContain('watch:../provider-events.jsonl')
    expect(events).not.toContain('dispose')
    await dev.stop(5_000)
    const closed = await readFile(path.join(project, 'provider-events.jsonl'), 'utf8')
    expect(closed.split('\"event\":\"dispose\"').length - 1).toBe(1)
  }, async () => {
    await dev.stop(5_000)
    await rm(project, { recursive: true, force: true })
  })
}, 150_000)
