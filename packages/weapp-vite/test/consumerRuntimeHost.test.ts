import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'
import { readCaseInventory } from '../../../e2e/scripts/domAcceptanceReport/inventoryAnalyzer'
import { createConsumerHmrConfig, resolveRuntimeCompilerCli, selectClassicRuntimeHost } from '../scripts/consumerRuntimeHost.mjs'

const repository = path.resolve(import.meta.dirname, '../../..')
const roots: string[] = []

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'consumer-host-')))
  roots.push(root)
  const repo = path.join(root, 'repository')
  const consumer = path.join(root, 'consumer')
  for (const base of [repo, consumer]) {
    await mkdir(base, { recursive: true })
    await writeFile(path.join(base, 'package.json'), '{"private":true}')
    for (const [name, bin] of [['weapp-vite', 'weapp-vite.js'], ['vite', 'vite.js'], ['vite-plus', 'vp']]) {
      const directory = path.join(base, 'node_modules', name!)
      await mkdir(path.join(directory, 'bin'), { recursive: true })
      await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name }))
      await writeFile(path.join(directory, 'bin', bin!), '')
    }
  }
  return { root, repo, consumer }
}

// 只执行真实 suite 的路径初始化段，不导入 automator、不注册或运行 runtime 用例。
async function readSuitePaths(file: string, repo: string, env: Record<string, string>) {
  const source = await readFile(path.join(repository, 'e2e/ide', file), 'utf8')
  const initialization = source.slice(source.indexOf('const ROOT ='), source.indexOf('const CONTROL_FILE ='))
  const globals = {
    path,
    createRequire,
    process: { env },
    moduleMeta: { dirname: path.join(repo, 'e2e/ide'), url: pathToFileURL(path.join(repo, 'e2e/ide', file)).href },
    resolveRuntimeCompilerCli,
  }
  const code = ts.transpileModule(initialization.replaceAll('import.meta', 'moduleMeta'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return runInNewContext(`${code}\n({ project: APP_ROOT, cli: typeof COMPILER_CLI !== 'undefined' ? COMPILER_CLI : undefined })`, globals) as { project: string, cli?: string }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('published runtime compiler ownership', () => {
  it.each(['wv', 'vite', 'vite-plus'])('runs stateful %s with the consumer launcher when the repository has a different installation', async (host) => {
    const { repo, consumer } = await fixture()
    const selected = await readSuitePaths('stateful-hmr.runtime.test.ts', repo, {
      WEAPP_VITE_E2E_COMPILER_HOST: host,
      WEAPP_VITE_E2E_STATEFUL_PROJECT: consumer,
    })
    const name = host === 'wv' ? 'weapp-vite' : host
    const bin = host === 'wv' ? 'weapp-vite.js' : host === 'vite' ? 'vite.js' : 'vp'
    expect(selected.project).toBe(consumer)
    expect(selected.cli).toBe(path.join(consumer, 'node_modules', name, 'bin', bin))
  })

  it('uses the isolated project for classic runtime rather than rewriting the workspace fixture', async () => {
    const { repo, consumer } = await fixture()
    const selected = await readSuitePaths('hmr-auto-classic.runtime.test.ts', repo, {
      WEAPP_VITE_E2E_COMPILER_HOST: 'wv',
      WEAPP_VITE_E2E_CLASSIC_PROJECT: consumer,
    })
    expect(selected.project).toBe(consumer)
  })

  it.each(['wv', 'vite', 'vite-plus'])('rejects ancestor installation fallback for isolated %s', async (host) => {
    const { repo } = await fixture()
    const consumer = path.join(repo, 'isolated')
    await mkdir(consumer)
    await writeFile(path.join(consumer, 'package.json'), '{"private":true}')
    expect(() => resolveRuntimeCompilerCli(host, consumer, { repositoryRoot: repo, isolated: true }))
      .toThrow('Runtime compiler escaped isolated consumer')
  })

  it('rejects a package link that resolves back into the repository', async () => {
    const { repo, consumer } = await fixture()
    const packagePath = path.join(consumer, 'node_modules/vite')
    await rm(packagePath, { recursive: true })
    await symlink(path.join(repo, 'node_modules/vite'), packagePath, 'junction')
    expect(() => resolveRuntimeCompilerCli('vite', consumer, { repositoryRoot: repo, isolated: true }))
      .toThrow('Runtime compiler escaped isolated consumer')
  })

  it('preserves the standalone workspace launcher and repository Vite for ordinary fixtures', async () => {
    const { repo, consumer } = await fixture()
    expect(resolveRuntimeCompilerCli('wv', consumer, { repositoryRoot: repo }))
      .toBe(path.join(repo, 'packages/weapp-vite/bin/weapp-vite.js'))
    expect(resolveRuntimeCompilerCli('vite', consumer, { repositoryRoot: repo }))
      .toBe(path.join(repo, 'node_modules/vite/bin/vite.js'))
  })

  it.each([
    ['wv', 'dev', 'wv'],
    ['vite', 'dev', 'vite'],
    ['vite-plus', 'dev', 'vite-plus'],
    ['vite', 'build-watch', 'vite-watch'],
    ['vite-plus', 'build-watch', 'vite-plus-watch'],
  ])('selects only the requested classic %s / %s case', (host, mode, selected) => {
    expect(selectClassicRuntimeHost(host, mode)).toBe(selected)
  })

  it('keeps the default source fixture case inventory unchanged', () => {
    const cases = readCaseInventory(repository, 'e2e/ide/hmr-auto-classic.runtime.test.ts')
    expect(cases.map(item => item.name)).toEqual(['wv', 'vite', 'vite-watch'].map(host => `${host} automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state`))
    expect(cases.flatMap(item => item.notes).filter(note => note.startsWith('Dynamic'))).toEqual([])
  })

  it.each(['wv', 'vite', 'vite-plus'])('generates native %s configs for both HMR contracts without a second compiler', (host) => {
    for (const runtime of ['classic', 'stateful-experimental']) {
      const required: string[] = []
      const exports: { default?: { plugins?: unknown[], weapp: { hmr: { runtime: string } } } } = {}
      const source = ts.transpileModule(createConsumerHmrConfig(host, runtime), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText
      runInNewContext(source, {
        exports,
        require(name: string) {
          required.push(name)
          return name === 'weapp-vite/vite' ? { weapp: () => 'consumer-plugin' } : { defineConfig: (config: unknown) => config }
        },
      })
      expect(required).toEqual(host === 'wv' ? ['weapp-vite'] : [host, 'weapp-vite/vite'])
      expect(exports.default?.weapp.hmr.runtime).toBe(runtime)
      expect(exports.default?.plugins).toEqual(host === 'wv' ? undefined : ['consumer-plugin'])
    }
  })
  it('rejects unknown hosts and unsupported standalone production-watch before launch', async () => {
    const { repo, consumer } = await fixture()
    expect(() => resolveRuntimeCompilerCli('other', consumer, { repositoryRoot: repo, isolated: true })).toThrow('Unsupported runtime compiler host')
    expect(() => selectClassicRuntimeHost('wv', 'build-watch')).toThrow('Standalone classic consumer')
    expect(() => selectClassicRuntimeHost('vite', 'other')).toThrow('Unsupported classic compiler mode')
  })
})
