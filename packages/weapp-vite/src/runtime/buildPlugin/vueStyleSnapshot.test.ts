import type { CompilerContext } from '../../context'
import { realpath, rename, symlink, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getCompilerSourceSnapshot, readCompilerInput, setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../plugins/utils/vueSfc'
import { createRuntimeState } from '../runtimeState'
import { withVueStyleDependencySnapshot } from './vueStyleSnapshot'

const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

async function fixture() {
  const root = await realpath(await fs.mkdtemp(path.join(tmpdir(), 'weapp-style-input-')))
  roots.push(root)
  const first = path.join(root, 'first.vue')
  const second = path.join(root, 'second.vue')
  const style = path.join(root, 'shared.css')
  const alternate = path.join(root, 'alternate.css')
  const script = path.join(root, 'script.js')
  const template = path.join(root, 'template.html')
  const source = '<script src="./script.js" /><template src="./template.html" /><style src="./shared.css" />'
  await Promise.all([
    fs.writeFile(first, source),
    fs.writeFile(second, source),
    fs.writeFile(style, '.target { color: black }'),
    fs.writeFile(alternate, '.target { color: v-bind(color) }'),
    fs.writeFile(script, 'export default {}'),
    fs.writeFile(template, '<view />'),
  ])
  let styleResolution = style
  const runtimeState = createRuntimeState()
  for (const entry of [first, second]) {
    runtimeState.build.hmr.resolvedEntryMap.set(entry, { id: entry })
    runtimeState.build.hmr.vueEntryStyleBindings.set(entry, { sources: [style, script, template], expressions: [] })
  }
  const ctx = {
    runtimeState,
    configService: { isDev: true },
    moduleGraphService: {
      async resolve(source: string, importer: string) {
        return { id: source === './shared.css' ? styleResolution : path.resolve(path.dirname(importer), source) }
      },
    },
  } as unknown as CompilerContext
  const parse = (entry = first) => readAndParseSfc(entry, createReadAndParseSfcOptions(ctx.moduleGraphService, ctx.configService))
  const switchResolution = () => {
    styleResolution = alternate
  }
  return { root, ctx, first, second, style, alternate, script, template, source, parse, switchResolution }
}

it('captures every owner and external block once before source and src topology change', async () => {
  const f = await fixture()
  const read = vi.spyOn(fs, 'readFile')
  const drift = vi.fn()
  await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.style], async () => {
    expect(read.mock.calls.filter(([file]) => file === f.style)).toHaveLength(1)
    await Promise.all([
      fs.writeFile(f.first, f.source.replace('./shared.css', './alternate.css')),
      fs.writeFile(f.style, '.target { color: v-bind(color) }'),
      fs.writeFile(f.script, 'export default { future: true }'),
      fs.writeFile(f.template, '<view>future</view>'),
    ])
    for (const entry of [f.first, f.second]) {
      const { descriptor } = await f.parse(entry)
      expect(descriptor.cssVars).toEqual([])
      expect(descriptor.script?.content).toBe('export default {}')
      expect(descriptor.template?.content).toBe('<view />')
    }
  }, drift)
  expect(drift).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([
    { file: f.first, event: 'update' },
    { file: f.style, event: 'update' },
    { file: f.script, event: 'update' },
    { file: f.template, event: 'update' },
  ]))
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
})

it('pins resolved src identities and queues a new scan when resolver topology changes', async () => {
  const f = await fixture()
  const drift = vi.fn()
  await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.style], async () => {
    f.switchResolution()
    expect((await f.parse()).descriptor.cssVars).toEqual([])
  }, drift)
  expect(drift).toHaveBeenCalledWith(expect.arrayContaining([{ file: f.first, event: 'update' }]))
  expect((await f.parse()).descriptor.cssVars).toEqual(['color'])
})

it('restores an outer snapshot and reports removed inputs even after a failed build', async () => {
  const f = await fixture()
  const previous = new Map([['virtual-input', 'preserved']])
  setCompilerSourceSnapshot(f.ctx.configService, previous)
  const drift = vi.fn(() => {
    expect(getCompilerSourceSnapshot(f.ctx.configService)).toBe(previous)
  })
  await expect(withVueStyleDependencySnapshot(f.ctx, [f.first], [f.style], async () => {
    await rename(f.style, path.join(f.root, 'renamed.css'))
    throw new Error('failed build')
  }, drift)).rejects.toThrow('failed build')
  expect(drift).toHaveBeenCalledWith(expect.arrayContaining([{ file: f.style, event: 'delete' }]))
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBe(previous)
  expect(await readCompilerInput(f.ctx.configService, f.alternate)).toContain('v-bind(color)')
})

it('keeps an external symlink bound to its captured physical source until the next scan', async () => {
  const f = await fixture()
  const link = path.join(f.root, 'linked.css')
  await symlink(f.style, link)
  await fs.writeFile(f.first, f.source.replace('./shared.css', './linked.css'))
  const drift = vi.fn()
  await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.style], async () => {
    await unlink(link)
    await symlink(f.alternate, link)
    expect((await f.parse()).descriptor.cssVars).toEqual([])
  }, drift)
  expect(drift).toHaveBeenCalledWith(expect.arrayContaining([{ file: f.first, event: 'update' }]))
  expect((await f.parse()).descriptor.cssVars).toEqual(['color'])
})

it('drains deferred external resolution and reads before failed capture enters the native full build', async () => {
  const f = await fixture()
  await fs.writeFile(f.first, '<template><view /></template><style src="./shared.css" /><style src="./alternate.css" />')
  const started = Promise.withResolvers<void>()
  const failed = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const read = fs.readFile.bind(fs)
  let alternateRead = false
  vi.spyOn(fs, 'readFile').mockImplementation((async (file: string, ...args: unknown[]) => {
    if (file === f.style) {
      failed.resolve()
      throw new Error('style input unavailable')
    }
    const source = await (read as (...args: unknown[]) => Promise<string>)(file, ...args)
    if (file === f.alternate) {
      alternateRead = true
    }
    return source
  }) as typeof fs.readFile)
  vi.spyOn(f.ctx.moduleGraphService, 'resolve').mockImplementation(async (source, importer) => {
    if (source === './alternate.css') {
      started.resolve()
      await release.promise
    }
    return { id: path.resolve(path.dirname(importer!), source) }
  })
  const native = vi.fn(async (options) => {
    expect(options).toEqual({ forceFullRescan: true })
    expect(alternateRead).toBe(true)
    expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
  })
  const drift = vi.fn()
  const capture = withVueStyleDependencySnapshot(f.ctx, [f.first], [], native, drift)
  try {
    await Promise.all([started.promise, failed.promise])
    expect(native).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
  }
  await capture
  expect(native).toHaveBeenCalledOnce()
  expect(drift).not.toHaveBeenCalled()
})

it('preserves the native build error when drift scheduling also fails', async () => {
  const f = await fixture()
  const buildError = new Error('native publication failed')
  const schedulingError = new Error('drift queue failed')
  const error = await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.style], async () => {
    await fs.writeFile(f.style, '.target { color: v-bind(color) }')
    throw buildError
  }, () => { throw schedulingError }).catch(error => error)
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([buildError, schedulingError])
  expect(error.cause).toBe(buildError)
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
})
