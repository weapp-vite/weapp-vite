import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it } from 'vitest'
import { bundleBrowserRuntime } from './bundle'

const directories: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'corpus-browser-bundle-'))
  directories.push(root)
  const files: Record<string, string> = {
    'package/tsconfig.json': JSON.stringify({ extends: './.weapp-vite/tsconfig.json' }),
    'package/dist/index.mjs': 'export { value } from "./shared.mjs"',
    'package/dist/core/index.mjs': 'export { value } from "../shared.mjs"',
    'package/dist/presets/index.mjs': 'export { preset } from "../presets.mjs"',
    'package/dist/shared.mjs': 'export const value = "compiled-js"',
    'package/dist/presets.mjs': 'export const preset = "frozen-preset"',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source)
  }
  const workspace = path.join(root, 'browser')
  await mkdir(workspace)
  const modulePath = (file: string) => JSON.stringify(path.join(root, 'package/dist', file).split(path.sep).join('/'))
  const entry = (variant: 'root' | 'core') => `
import { value } from ${modulePath(variant === 'root' ? 'index.mjs' : 'core/index.mjs')};
import { preset } from ${modulePath('presets/index.mjs')};
const observed: { value: string, preset: string } = { value, preset };
globalThis.probe = observed;
`
  return { root, workspace, entry }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('frozen browser runtime bundling', () => {
  it.each(['root', 'core'] as const)('bundles the %s entry and preset chunks without generated source tsconfigs', async (variant) => {
    const { workspace, entry } = await fixture()
    const code = await bundleBrowserRuntime(entry(variant), workspace)
    const context: { probe?: unknown } = {}

    runInNewContext(code, context)

    expect(context.probe).toEqual({ value: 'compiled-js', preset: 'frozen-preset' })
  })

  it('still rejects a missing JavaScript chunk', async () => {
    const { root, workspace, entry } = await fixture()
    await rm(path.join(root, 'package/dist/shared.mjs'))

    await expect(bundleBrowserRuntime(entry('root'), workspace)).rejects.toThrow('shared.mjs')
  })
})
