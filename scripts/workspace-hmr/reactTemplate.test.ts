import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planWorkspaceHmrScenarios } from './delivery'
import { isDynamicReactTemplateOutput, resolveReactTemplateScenarioCapability, waitForReactTemplateScriptOutput } from './reactTemplate'

const tempDirectories: string[] = []

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-react-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('React HMR template discovery', () => {
  it.each([
    [false, 'export function View() { return <view>static</view> }'],
    [true, 'export const View = () => <view>dynamic</view>'],
  ] as const)('freezes dynamic=%s template fallback before any mutation or actual delivery', (dynamic, source) => {
    const capability = resolveReactTemplateScenarioCapability(source, '/project/src/pages/index/view.tsx', dynamic, 'stateful')
    const planned = planWorkspaceHmrScenarios('stateful', [
      { id: 'template', ...capability },
      { id: 'native-script', statefulTemplate: false },
      { id: 'native-style', classicFallbackReason: 'stylesheet-output' },
    ])
    expect(planned.map(item => [item.id, item.expectedDelivery, item.expectedFallbackReason])).toEqual([
      ['native-script', 'stateful', undefined],
      ['template', 'classic-fallback', 'patch-shape'],
      ['native-style', 'classic', undefined],
    ])
    const classic = resolveReactTemplateScenarioCapability(source, '/project/src/pages/index/view.tsx', dynamic, 'standard')
    expect(planWorkspaceHmrScenarios('standard', [{ id: 'template', ...classic }])[0]).toMatchObject({ expectedDelivery: 'classic', expectedFallbackReason: undefined })
  })

  it('rejects invalid source instead of planning a successful fallback', () => {
    expect(() => resolveReactTemplateScenarioCapability('export const View = <', '/project/src/view.tsx', true, 'stateful')).toThrow()
  })

  it('can discover an auto dynamic source before an initial output exists', () => {
    expect(resolveReactTemplateScenarioCapability('export const View = () => <view />', '/project/src/view.tsx', undefined, 'stateful'))
      .toEqual({ statefulTemplate: true, classicFallbackReason: 'patch-shape' })
  })

  it('observes a dynamic template marker in the reachable emitted chunk for both update and restoration', async () => {
    const distRoot = await createTemporaryDirectory()
    const entryFile = path.join(distRoot, 'index.js')
    const dependency = path.join(distRoot, 'render.js')
    await writeFile(entryFile, 'require("./render.js")')
    await writeFile(dependency, 'console.log("current-marker")')
    await expect(waitForReactTemplateScriptOutput({ entryFile, distRoot, marker: 'current-marker', contains: true, deadline: Date.now() + 1_000 })).resolves.toBeUndefined()
    await writeFile(dependency, 'console.log("restored")')
    await writeFile(path.join(distRoot, 'unused.js'), 'console.log("current-marker")')
    await expect(waitForReactTemplateScriptOutput({ entryFile, distRoot, marker: 'current-marker', contains: false, deadline: Date.now() + 1_000 })).resolves.toBeUndefined()
  })

  it('does not accept a missing dependency as a restored dynamic template', async () => {
    const distRoot = await createTemporaryDirectory()
    const entryFile = path.join(distRoot, 'index.js')
    await writeFile(entryFile, 'require("./missing.js")')
    await expect(waitForReactTemplateScriptOutput({ entryFile, distRoot, marker: 'current-marker', contains: false, deadline: Date.now() + 30 }))
      .rejects
      .toThrow('does not match')
  })

  it('allows missing output only before the first build', async () => {
    const filename = path.join(await createTemporaryDirectory(), 'index.wxml')
    await expect(isDynamicReactTemplateOutput(filename, false)).resolves.toBe(false)
    await expect(isDynamicReactTemplateOutput(filename, true)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reads actual generated template mode after output is written', async () => {
    const filename = path.join(await createTemporaryDirectory(), 'index.wxml')
    await writeFile(filename, '<view>{{count}}</view>')
    await expect(isDynamicReactTemplateOutput(filename, true)).resolves.toBe(false)
    await writeFile(filename, '<template is="react_root" data="{{root:root}}" />')
    await expect(isDynamicReactTemplateOutput(filename, true)).resolves.toBe(true)
  })

  it('does not mistake unreadable output for a static template', async () => {
    const directory = await createTemporaryDirectory()
    await expect(isDynamicReactTemplateOutput(directory, false)).rejects.toBeInstanceOf(Error)
    await expect(isDynamicReactTemplateOutput(directory, true)).rejects.toBeInstanceOf(Error)
  })
})
