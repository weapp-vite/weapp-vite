import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { compileVueSharedRuntime } from './compileVueSharedRuntime'

it('compiles the standalone runtime with unprepared application tsconfig references', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'vue-shared-runtime-')))
  try {
    const runtimeRoot = path.join(root, 'packages-runtime/wevu/src')
    await mkdir(runtimeRoot, { recursive: true })
    await mkdir(path.join(root, 'unused-app'))
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      files: [],
      references: [{ path: './unused-app' }],
    }))
    await writeFile(path.join(root, 'unused-app/tsconfig.json'), JSON.stringify({
      extends: './.weapp-vite/tsconfig.shared.json',
    }))
    await writeFile(path.join(runtimeRoot, 'internal-runtime.ts'), `
      export const createWevuComponent = (value: string) => 'component:' + value;
      export const installInlineEvents = (value: string) => 'events:' + value;
    `)
    await writeFile(path.join(runtimeRoot, 'internal-reactivity.ts'), 'export const ref = (value: number) => ({ value });')
    await writeFile(path.join(runtimeRoot, 'scheduler.ts'), 'export const nextTick = () => Promise.resolve("ready");')

    const { code } = await compileVueSharedRuntime(root)
    const module = { exports: {} as {
      createWevuComponent: (value: string) => string
      installInlineEvents: (value: string) => string
      ref: (value: number) => { value: number }
      nextTick: () => Promise<string>
    } }
    runInNewContext(code, { module, exports: module.exports })
    expect(module.exports.createWevuComponent('counter')).toBe('component:counter')
    expect(module.exports.installInlineEvents('tap')).toBe('events:tap')
    expect(module.exports.ref(42)).toEqual({ value: 42 })
    await expect(module.exports.nextTick()).resolves.toBe('ready')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
