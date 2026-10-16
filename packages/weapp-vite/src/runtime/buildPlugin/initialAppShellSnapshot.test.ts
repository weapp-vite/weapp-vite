import type { CompilerContext } from '../../context'
import { realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getCompilerSourceSnapshot, readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../plugins/utils/vueSfc'
import { createRuntimeState } from '../runtimeState'
import { captureAppShellSnapshot, withInitialAppShellSnapshot } from './appShellSnapshot'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

async function fixture(source: string) {
  const root = await realpath(await fs.mkdtemp(path.join(tmpdir(), 'weapp-initial-shell-')))
  roots.push(root)
  const appId = path.join(root, 'app.vue')
  await fs.writeFile(appId, source)
  const ctx = {
    runtimeState: createRuntimeState(),
    scanService: { appEntry: { path: appId } },
    configService: { isDev: true },
    moduleGraphService: {
      async resolve(source: string, importer: string) {
        return { id: path.resolve(path.dirname(importer), source) }
      },
    },
  } as unknown as CompilerContext
  return { root, appId, ctx }
}

it.each([false, true])('keeps initial App source and publication metadata in one generation without watcher events (before=%s)', async (before) => {
  const source = (present: boolean) => `<script setup>const marker = 'app'</script>${present ? '<template><view><slot /></view></template>' : ''}`
  const f = await fixture(source(before))
  const drift = vi.fn()
  await withInitialAppShellSnapshot(f.ctx, async () => {
    expect(await readCompilerInput(f.ctx.configService, f.appId)).toBe(source(before))
    await fs.writeFile(f.appId, source(!before))
    f.ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(f.appId, !before)
    expect(await readCompilerInput(f.ctx.configService, f.appId)).toBe(source(before))
    expect(await captureAppShellSnapshot(f.ctx)).toEqual({ appId: f.appId, hasTemplate: before })
  }, drift)
  expect(drift).toHaveBeenCalledExactlyOnceWith([{ file: f.appId, event: 'update' }])
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
  expect(await readCompilerInput(f.ctx.configService, f.appId)).toBe(source(!before))
})

it('pins external template, script and style through a failed initial build and reports their drift', async () => {
  const f = await fixture('<script src="./app.js" /><template src="./app.html" /><style src="./app.css" />')
  const inputs = new Map([
    [path.join(f.root, 'app.js'), 'export default {}'],
    [path.join(f.root, 'app.html'), '<view><slot /></view>'],
    [path.join(f.root, 'app.css'), 'view { color: red; }'],
  ])
  await Promise.all([...inputs].map(([file, content]) => fs.writeFile(file, content)))
  const failure = new Error('initial publication failed')
  const drift = vi.fn()
  await expect(withInitialAppShellSnapshot(f.ctx, async () => {
    await Promise.all([...inputs].map(([file]) => fs.writeFile(file, 'changed during build')))
    const { descriptor } = await readAndParseSfc(f.appId, createReadAndParseSfcOptions(f.ctx.moduleGraphService, f.ctx.configService))
    expect(descriptor.script?.content).toBe('export default {}')
    expect(descriptor.template?.content).toBe('<view><slot /></view>')
    expect(descriptor.styles[0]?.content).toBe('view { color: red; }')
    throw failure
  }, drift)).rejects.toBe(failure)
  expect(drift).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining([...inputs.keys()].map(file => ({ file, event: 'update' }))))
  expect(getCompilerSourceSnapshot(f.ctx.configService)).toBeUndefined()
})
