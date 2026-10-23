import type { ViteDevServer } from 'vite'
import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerContext } from '../../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { getCompilerHmrHost } from '../compilerPlugin/hmr'
import { createTailwindHmrAdapter } from './hmr'

const require = createRequire(import.meta.url)
const cleanup: (() => Promise<void>)[] = []
const sourceCss = '@import "tailwindcss/utilities" source(none); @source "./**/*";'

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-dependency-ownership-')))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'node_modules'))
  await mkdir(path.join(root, 'src'))
  await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
  const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
  cleanup.push(() => compiler.dispose())
  const entry = path.join(root, 'src/app.css')
  const dependency = path.join(root, 'src/ordinary.css')
  const candidate = path.join(root, 'src/candidate.css')
  const source = path.join(root, 'src/source.ts')
  await writeFile(entry, `${sourceCss} @import "./ordinary.css";`)
  await writeFile(dependency, '.ordinary { color: red; }')
  await writeFile(candidate, '.candidate { color: red; }')
  await writeFile(source, 'export const utility = "w-[37px]"')
  const onSourceChange = vi.fn()
  const ctx = {
    configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
    onStatefulHmrSourceChange: onSourceChange,
  } as unknown as CompilerContext
  const host = getCompilerHmrHost(ctx)
  host.onDependencyChange = vi.fn()
  const adapter = createTailwindHmrAdapter(ctx, { compiler: async () => compiler, render: async () => {} })
  cleanup.push(async () => adapter.dispose())
  const watcher = Object.assign(new EventEmitter(), { add: vi.fn() })
  const logger = { error: vi.fn() }
  adapter.configureServer({ watcher, config: { logger } } as unknown as ViteDevServer)
  const request: CompilerGenerateRequest = { id: 'imported-style', sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: true, target: 'weapp' }
  const generated = await compiler.generate(request)
  expect(generated.dependencies).toContain(dependency)
  expect(generated.dependencies).not.toContain(candidate)
  expect(generated.dependencies).not.toContain(source)
  return { adapter, compiler, host, watcher, logger, onSourceChange, request, generated, entry, dependency, candidate, source }
}

async function deleteAndObserve(file: string, host: ReturnType<typeof getCompilerHmrHost>, watcher: EventEmitter) {
  const deleted = Promise.withResolvers<void>()
  const stop = host.observeInputCaptures((observation) => {
    if (observation.after.source.state === 'deleted') {
      deleted.resolve()
    }
  })
  try {
    await rm(file)
    watcher.emit('unlink', file)
    await deleted.promise
  }
  finally {
    stop()
  }
}

it('captures native CSS dependency changes without starting a duplicate content batch', async () => {
  const { adapter, host, watcher, logger, onSourceChange, request, generated, dependency, candidate, source } = await fixture()
  await adapter.rememberRoot('imported-owner', request, generated)
  await writeFile(dependency, '.ordinary { color: blue; }')
  watcher.emit('change', dependency)
  expect(host.readSource(dependency)).toContain('blue')
  expect(host.onDependencyChange).not.toHaveBeenCalled()
  expect(onSourceChange).not.toHaveBeenCalled()
  await deleteAndObserve(dependency, host, watcher)
  expect(host.readSource(dependency)).toBeNull()
  expect(host.onDependencyChange).not.toHaveBeenCalled()
  expect(onSourceChange).not.toHaveBeenCalled()

  // 相同扩展名不能代替实际编译依赖归属；扫描候选仍走内容更新路径。
  for (const file of [candidate, source]) {
    host.captureNative(file, await readFile(file, 'utf8'))
    await writeFile(file, '/* w-[53px] */')
    watcher.emit('change', file)
    expect(host.readSource(file)).toContain('53px')
    expect(host.onDependencyChange).toHaveBeenCalledWith(file)
    expect(onSourceChange).toHaveBeenCalledWith(file, ['tailwind-content:1'])
  }
  expect(host.onDependencyChange).toHaveBeenCalledTimes(2)
  expect(logger.error).not.toHaveBeenCalled()
})

it('retains native dependency ownership while an imported root is between generations', async () => {
  const { adapter, host, watcher, onSourceChange, request, generated, dependency } = await fixture()
  await adapter.rememberRoot('imported-owner', request, generated)
  const token = adapter.beginRootGeneration('imported-owner')
  expect(adapter.hasRoot('imported-owner')).toBe(false)
  for (const color of ['blue', 'green']) {
    await writeFile(dependency, `.ordinary { color: ${color}; }`)
    watcher.emit('change', dependency)
    expect(host.readSource(dependency)).toContain(color)
  }
  await deleteAndObserve(dependency, host, watcher)
  expect(host.readSource(dependency)).toBeNull()
  expect(host.onDependencyChange).not.toHaveBeenCalled()
  expect(onSourceChange).not.toHaveBeenCalled()
  await writeFile(dependency, '.ordinary { color: red; }')
  await adapter.rememberRoot('imported-owner', request, generated, token)
  watcher.emit('change', dependency)
  expect(host.readSource(dependency)).toContain('red')
  expect(host.onDependencyChange).not.toHaveBeenCalled()
})

it('releases replaced dependencies and retains a shared dependency until its last owner is removed', async () => {
  const { adapter, compiler, host, watcher, onSourceChange, request, generated, dependency, entry } = await fixture()
  await adapter.rememberRoot('first-owner', request, generated)
  await adapter.rememberRoot('second-owner', request, generated)
  // 第三个 root 仅扫描同一文件；前两个 owner 移除后由它正常交付内容变化。
  const scannerEntry = path.join(path.dirname(entry), 'scanner.css')
  await writeFile(scannerEntry, sourceCss)
  const scannerRequest: CompilerGenerateRequest = { ...request, id: 'scanner', sourceOptions: { ...request.sourceOptions, cssEntries: [scannerEntry] } }
  const scanned = await compiler.generate(scannerRequest)
  expect(scanned.dependencies).not.toContain(dependency)
  await adapter.rememberRoot(0, scannerRequest, scanned)
  host.captureNative(dependency, await readFile(dependency, 'utf8'))
  await adapter.rememberRoot('first-owner', scannerRequest, scanned)
  await writeFile(dependency, '.ordinary { color: blue; }')
  watcher.emit('change', dependency)
  expect(host.readSource(dependency)).toContain('blue')
  expect(host.onDependencyChange).not.toHaveBeenCalled()
  adapter.removeRoot('second-owner')
  await writeFile(dependency, '.ordinary { color: green; }')
  watcher.emit('change', dependency)
  expect(host.readSource(dependency)).toContain('green')
  expect(host.onDependencyChange).toHaveBeenCalledTimes(1)
  expect(host.onDependencyChange).toHaveBeenCalledWith(dependency)
  expect(onSourceChange).toHaveBeenCalledTimes(1)
  expect(onSourceChange).toHaveBeenCalledWith(dependency, ['tailwind-content:1'])
  adapter.dispose()
  adapter.dispose()
  await writeFile(dependency, '.ordinary { color: black; }')
  watcher.emit('change', dependency)
  expect(host.readSource(dependency)).toContain('green')
  expect(host.onDependencyChange).toHaveBeenCalledTimes(1)
})
