import type { CompilerContext } from '../../context'
import { realpath, rename, symlink, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getCompilerSourceSnapshot, readCompilerInput, setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../plugins/utils/vueSfc'
import { createRuntimeState } from '../runtimeState'
import { captureAppShellSnapshot, resolveAppShellSnapshotChange } from './appShellSnapshot'
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

it('pins an App shell without external blocks and queues its source drift through the existing snapshot callback', async () => {
  const f = await fixture()
  const appId = path.join(f.root, 'app.vue')
  const before = '<script setup>const marker = "app"</script>'
  const after = `${before}<template><view><slot /></view></template>`
  await fs.writeFile(appId, before)
  const committed = { appId, hasTemplate: false }
  const drift = vi.fn()
  const read = vi.spyOn(fs, 'readFile')
  await withVueStyleDependencySnapshot(f.ctx, [], [], async () => {
    expect(read.mock.calls.filter(([file]) => file === appId)).toHaveLength(1)
    await fs.writeFile(appId, after)
    expect(await readCompilerInput(f.ctx.configService, appId)).toBe(before)
    expect(await resolveAppShellSnapshotChange(f.ctx, committed)).toBeUndefined()
    f.ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, true)
    expect(await captureAppShellSnapshot(f.ctx, appId)).toEqual(committed)
  }, drift, { entries: [appId], resolveAffectedEntries: async () => [] })
  expect(drift).toHaveBeenCalledExactlyOnceWith([{ file: appId, event: 'update' }])
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
  expect(await readCompilerInput(f.ctx.configService, appId)).toBe(after)
})

it('expands a pinned App shell change before selecting page inputs even when its event is delayed', async () => {
  const f = await fixture()
  const appId = path.join(f.root, 'app.vue')
  const appSource = '<script setup>const marker = "app"</script><template><view><slot /></view></template>'
  await fs.writeFile(appId, appSource)
  for (const id of [f.first, f.second]) {
    f.ctx.runtimeState.build.hmr.entriesMap.set(id, { type: 'page', path: id } as any)
  }
  const committed = { appId, hasTemplate: false }
  const drift = vi.fn()
  const read = vi.spyOn(fs, 'readFile')
  await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.first], async () => {
    for (const id of [appId, f.first, f.second, f.style, f.script, f.template]) {
      expect(read.mock.calls.filter(([file]) => file === id)).toHaveLength(1)
    }
    await Promise.all([
      fs.writeFile(appId, '<script setup>const marker = "future"</script>'),
      fs.writeFile(f.second, '<template><view>future</view></template>'),
      fs.writeFile(f.style, '.target { color: v-bind(color) }'),
      fs.writeFile(f.script, 'export default { future: true }'),
      fs.writeFile(f.template, '<view>future</view>'),
    ])
    for (const id of [f.first, f.second]) {
      const { descriptor } = await f.parse(id)
      expect(descriptor.cssVars).toEqual([])
      expect(descriptor.script?.content).toBe('export default {}')
      expect(descriptor.template?.content).toBe('<view />')
    }
    expect(await captureAppShellSnapshot(f.ctx, appId)).toEqual({ appId, hasTemplate: true })
  }, drift, {
    entries: [appId],
    async resolveAffectedEntries() {
      const change = await resolveAppShellSnapshotChange(f.ctx, committed)
      expect(change?.pageIds).toEqual(new Set([f.first, f.second]))
      return change ? [change.appId, ...change.pageIds] : []
    },
  })
  expect(drift).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([
    { file: appId, event: 'update' },
    { file: f.second, event: 'update' },
    { file: f.style, event: 'update' },
    { file: f.script, event: 'update' },
    { file: f.template, event: 'update' },
  ]))
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
})

it('captures only affected page owners when a pinned App shell keeps its published presence', async () => {
  const f = await fixture()
  const appId = path.join(f.root, 'app.vue')
  await fs.writeFile(appId, '<script setup>const marker = "app"</script>')
  const read = vi.spyOn(fs, 'readFile')
  await withVueStyleDependencySnapshot(f.ctx, [f.first], [f.first], async () => {
    expect(read.mock.calls.some(([file]) => file === f.second)).toBe(false)
    expect(read.mock.calls.filter(([file]) => file === f.first)).toHaveLength(1)
  }, vi.fn(), {
    entries: [appId],
    async resolveAffectedEntries() {
      expect(await resolveAppShellSnapshotChange(f.ctx, { appId, hasTemplate: false })).toBeUndefined()
      return []
    },
  })
})

it.each([false, true])('uses the captured external App template presence instead of the raw src tag (before=%s)', async (before) => {
  const f = await fixture()
  const appId = path.join(f.root, 'app.vue')
  const shell = path.join(f.root, 'shell.html')
  await fs.writeFile(appId, '<template src="./shell.html" />')
  await fs.writeFile(shell, before ? ' \n ' : '<view><slot /></view>')
  f.ctx.runtimeState.build.hmr.entriesMap.set(f.first, { type: 'page', path: f.first } as any)
  await withVueStyleDependencySnapshot(f.ctx, [], [shell], async () => {
    f.ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appId, before)
    expect(await captureAppShellSnapshot(f.ctx, appId)).toEqual({ appId, hasTemplate: !before })
  }, vi.fn(), {
    entries: [appId],
    async resolveAffectedEntries() {
      const change = await resolveAppShellSnapshotChange(f.ctx, { appId, hasTemplate: before })
      expect(change).toEqual({ appId, pageIds: new Set([f.first]) })
      return change ? [change.appId, ...change.pageIds] : []
    },
  })
})

it('replays external App template resolution changes through the same captured input and drift queue', async () => {
  const f = await fixture()
  const appId = path.join(f.root, 'app.vue')
  const shell = path.join(f.root, 'shell.html')
  const empty = path.join(f.root, 'empty.html')
  await fs.writeFile(appId, '<template src="./shell.html" />')
  await fs.writeFile(shell, '<view><slot /></view>')
  await fs.writeFile(empty, ' \n ')
  let target = shell
  const resolve = f.ctx.moduleGraphService.resolve.bind(f.ctx.moduleGraphService)
  vi.spyOn(f.ctx.moduleGraphService, 'resolve').mockImplementation(async (source, importer) => {
    return source === './shell.html' ? { id: target } : await resolve(source, importer)
  })
  const drift = vi.fn()
  let committed = { appId, hasTemplate: false }
  const published: boolean[] = []
  for (const next of [true, false]) {
    await withVueStyleDependencySnapshot(f.ctx, [], [], async () => {
      if (next) {
        target = empty
      }
      const captured = await captureAppShellSnapshot(f.ctx, appId)
      expect(captured?.hasTemplate).toBe(next)
      committed = captured!
      published.push(committed.hasTemplate)
    }, drift, {
      entries: [appId],
      async resolveAffectedEntries() {
        const change = await resolveAppShellSnapshotChange(f.ctx, committed)
        expect(change?.appId).toBe(appId)
        return change ? [change.appId, ...change.pageIds] : []
      },
    })
  }
  expect(published).toEqual([true, false])
  expect(drift).toHaveBeenCalledExactlyOnceWith([{ file: appId, event: 'update' }])
})
