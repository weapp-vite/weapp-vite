import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../../context'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  assertStylePreprocessing,
  beginStylePreprocessing,
  captureCompiledStyleSource,
  captureStylePreprocessorInput,
  closeStylePreprocessing,
  consumeStylePreprocessing,
  findPreparedStyleDependencies,
  getPreparedSharedStyle,
  getPreparedStyleSource,
  prepareStylePreprocessing,
} from './index'

const preprocess = vi.hoisted(() => vi.fn())
vi.mock('vite', () => ({ preprocessCSS: preprocess }))

const roots: string[] = []
afterEach(async () => {
  preprocess.mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(source = '@brand: red; .page { color: @brand; }') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-style-generation-'))
  roots.push(root)
  const file = path.join(root, 'index.less')
  await writeFile(file, source)
  const ctx = {
    configService: { cwd: root },
    runtimeState: { css: { transformedSidecarSource: new Map() } },
  } as unknown as CompilerContext
  const hook = { environment: {}, addWatchFile: vi.fn() }
  const config = {} as ResolvedConfig
  return { ctx, hook, config, file, source }
}

it('freezes current input through multiple outputs and re-evaluates the next generation', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  let graphOpen = true
  preprocess.mockImplementation(async (code: string) => {
    if (!graphOpen) {
      throw new Error('The graph preprocessor has already closed')
    }
    return { code: code.includes('red') ? '.page{color:red}' : '.page{color:blue}', deps: new Set([path.join(path.dirname(file), 'theme.less')]) }
  })
  beginStylePreprocessing(ctx, hook)
  await prepareStylePreprocessing(ctx, hook, config, [file, file])
  graphOpen = false
  await writeFile(file, source.replace('red', 'blue'))
  for (let output = 0; output < 2; output++) {
    expect(getPreparedStyleSource(ctx, hook, file)).toBe(source)
    expect((await consumeStylePreprocessing(ctx, hook, config, file, source)).code).toBe('.page{color:red}')
  }
  expect(preprocess).toHaveBeenCalledTimes(1)
  expect(hook.addWatchFile).toHaveBeenCalledWith(path.join(path.dirname(file), 'theme.less').replaceAll('\\', '/'))

  graphOpen = true
  beginStylePreprocessing(ctx, hook)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  graphOpen = false
  const updated = getPreparedStyleSource(ctx, hook, file)!
  expect(updated).toContain('blue')
  expect((await consumeStylePreprocessing(ctx, hook, config, file, updated)).code).toBe('.page{color:blue}')
  await expect(consumeStylePreprocessing(ctx, hook, config, file, source)).rejects.toThrow('输出阶段改变了未经编译的内容')
  expect(preprocess).toHaveBeenCalledTimes(2)
})

it('retains graph compiled CSS while collecting exact preprocessor dependencies from its source input', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  const originalInput = `${source}\n.from-source-plugin { color: orange; }`
  const compiled = { code: '.from-user-plugin{color:purple}', diskSource: source }
  const dependency = path.join(path.dirname(file), 'injected-theme.less')
  ctx.runtimeState.css.transformedSidecarSource.set(file.replaceAll('\\', '/'), compiled)
  beginStylePreprocessing(ctx, hook)
  captureStylePreprocessorInput(ctx, hook, file, { code: originalInput, diskSource: source })
  captureCompiledStyleSource(ctx, hook, file, compiled, config)
  preprocess.mockResolvedValue({ code: '.from-source-plugin{color:orange}', deps: new Set([dependency]) })
  await prepareStylePreprocessing(ctx, hook, config, [file])
  expect(getPreparedStyleSource(ctx, hook, file)).toBe(compiled.code)
  expect((await consumeStylePreprocessing(ctx, hook, config, file, compiled.code)).code).toBe(compiled.code)
  expect(findPreparedStyleDependencies(ctx, hook, file)).toEqual([dependency])
  const shared = getPreparedSharedStyle(ctx, hook, file)!
  expect(shared).toEqual({ css: compiled.code, source, dependencies: [dependency] })
  shared.dependencies.push('mutated')
  expect(getPreparedSharedStyle(ctx, hook, file)!.dependencies).toEqual([dependency])
  expect(preprocess).toHaveBeenCalledExactlyOnceWith(originalInput, file.replaceAll('\\', '/'), config)
  await expect(consumeStylePreprocessing(ctx, hook, config, file, '.late-output-plugin{color:green}')).rejects.toThrow('请将样式转换移到图阶段')
  expect(preprocess).toHaveBeenCalledTimes(1)
})

it('restores opaque public URLs while preserving graph-stage native inline and emitted URLs', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  config.publicDir = path.join(path.dirname(file), 'public')
  await mkdir(path.join(config.publicDir, 'images'), { recursive: true })
  await writeFile(path.join(config.publicDir, 'images/background.png'), 'public image')
  const compiled = { code: '.page{background:url(__VITE_PUBLIC_ASSET__opaque__),url("data:image/svg+xml,%3Csvg%3E"),url("./assets/emitted.svg")}', diskSource: source }
  const processed = '.page{background:url(/images/background.png),url("./inline.svg"),url("./emitted.svg")}'
  const resolved = compiled.code.replace('__VITE_PUBLIC_ASSET__opaque__', '/images/background.png')
  ctx.runtimeState.css.transformedSidecarSource.set(file.replaceAll('\\', '/'), compiled)
  preprocess.mockResolvedValue({ code: processed, deps: [] })
  beginStylePreprocessing(ctx, hook)
  captureCompiledStyleSource(ctx, hook, file, compiled, config)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  expect(getPreparedStyleSource(ctx, hook, file)).toBe(resolved)
  expect((await consumeStylePreprocessing(ctx, hook, config, file, compiled.code)).code).toBe(resolved)
  expect(preprocess).toHaveBeenCalledExactlyOnceWith(source, file.replaceAll('\\', '/'), config)
})

it('reprocesses unchanged disk input after a dependency changes without reusing an older generation compiled result', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  const compiled = { code: '.page{color:red}', diskSource: source }
  ctx.runtimeState.css.transformedSidecarSource.set(file.replaceAll('\\', '/'), compiled)
  preprocess.mockResolvedValueOnce({ code: compiled.code, deps: [] })
  beginStylePreprocessing(ctx, hook)
  captureCompiledStyleSource(ctx, hook, file, compiled, config)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  expect((await consumeStylePreprocessing(ctx, hook, config, file, source)).code).toBe(compiled.code)

  preprocess.mockResolvedValueOnce({ code: '.page{color:blue}', deps: [] })
  beginStylePreprocessing(ctx, hook)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  expect((await consumeStylePreprocessing(ctx, hook, config, file, source)).code).toBe('.page{color:blue}')
  expect(preprocess).toHaveBeenNthCalledWith(2, source, file.replaceAll('\\', '/'), config)
})

it('isolates environments and rejects missing or retired output inputs without late compilation', async () => {
  const { ctx, hook, config, file, source } = await fixture()
  const other = { environment: {} }
  preprocess.mockImplementation(async (code: string) => ({ code, deps: [] }))
  beginStylePreprocessing(ctx, hook)
  beginStylePreprocessing(ctx, other)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  await prepareStylePreprocessing(ctx, other, config, [])
  await expect(consumeStylePreprocessing(ctx, other, config, file, source)).rejects.toThrow('没有本轮图阶段的预处理结果')
  closeStylePreprocessing(ctx, hook)
  closeStylePreprocessing(ctx, hook)
  await expect(consumeStylePreprocessing(ctx, hook, config, file, source)).rejects.toThrow('没有本轮图阶段的预处理结果')
  expect(preprocess).toHaveBeenCalledTimes(1)
})

it('waits for all pending preparation and preserves its original failure until output after Vite cleanup', async () => {
  const { ctx, hook, config, file } = await fixture()
  const second = path.join(path.dirname(file), 'second.less')
  await writeFile(second, '.second{}')
  const original = new Error('Less syntax failure')
  let complete!: () => void
  const pending = new Promise<void>(resolve => complete = resolve)
  preprocess.mockImplementation(async (_code: string, filename: string) => {
    if (filename === file.replaceAll('\\', '/')) {
      throw original
    }
    await pending
    return { code: '.second{}', deps: [] }
  })
  beginStylePreprocessing(ctx, hook)
  let ready = false
  const preparation = prepareStylePreprocessing(ctx, hook, config, [file, second]).then(() => ready = true)
  await vi.waitFor(() => expect(preprocess).toHaveBeenCalledTimes(2))
  expect(ready).toBe(false)
  complete()
  await preparation
  // 图阶段保留错误但完成屏障，让后续 Vite buildEnd 仍能关闭已创建的池。
  expect(() => assertStylePreprocessing(ctx, hook)).toThrow(original)
  await expect(consumeStylePreprocessing(ctx, hook, config, file, '.invalid{}')).rejects.toBe(original)
  expect(preprocess).toHaveBeenCalledTimes(2)
})

it('preserves an undefined thrown value across close without treating it as successful preparation', async () => {
  const { ctx, hook, config, file } = await fixture()
  preprocess.mockRejectedValue(undefined)
  beginStylePreprocessing(ctx, hook)
  await prepareStylePreprocessing(ctx, hook, config, [file])
  const notThrown = Symbol('not thrown')
  const thrown = () => {
    try {
      assertStylePreprocessing(ctx, hook)
      return notThrown
    }
    catch (error) {
      return error
    }
  }
  expect(thrown()).toBeUndefined()
  closeStylePreprocessing(ctx, hook)
  expect(thrown()).toBeUndefined()
  beginStylePreprocessing(ctx, hook)
  expect(thrown()).toBe(notThrown)
})
