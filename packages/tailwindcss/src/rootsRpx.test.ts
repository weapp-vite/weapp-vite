import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { TailwindRootState } from './roots'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createCompiler } from 'weapp-tailwindcss/core'
import { prepareTailwindRoots } from './roots'

const require = createRequire(import.meta.url)

it('preserves complete rpx stylesheet bytes across disk generation, captured script changes and restored utilities', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-root-rpx-')))
  const compiler = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  const reference = createCompiler({ tailwindcssBasedir: root, appType: 'weapp-vite' })
  try {
    await mkdir(path.join(root, 'node_modules'))
    await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
    const entry = path.join(root, 'app.css')
    const source = path.join(root, 'page.vue')
    const css = '@import "tailwindcss"; @source "./page.vue";'
    const initialSource = '<script setup lang="ts">const count = 1</script><template><view class="text-[24rpx] leading-[1.6] text-[#64748b] font-semibold"><text class="text-[38rpx]">{{ count }}</text></view></template>'
    await writeFile(entry, css)
    await writeFile(source, initialSource)
    const request: CompilerGenerateRequest = {
      id: 'rpx-root',
      sourceOptions: { projectRoot: root, cssEntries: [entry] },
      scanSources: true,
      incrementalCache: false,
      target: 'weapp',
    }
    const initial = await compiler.generate(request)
    expect(initial.classSet.has('text-[24rpx]')).toBe(true)
    expect(initial.classSet.has('text-[38rpx]')).toBe(true)
    expect(initial.css).toMatch(/font-size:\s*38rpx/)
    const sources = new Map<string, string>()
    for (const file of [...initial.dependencies, source]) {
      sources.set(file, await readFile(file, 'utf8'))
    }
    const state: TailwindRootState = { request, result: initial, rawSources: new Map([[entry, css]]) }
    const roots = new Map([['root', state]])
    const prepare = async (nextSource: string, revision: number) => {
      await writeFile(source, nextSource)
      const expected = await reference.generate({ ...request, id: `disk-reference-${revision}` })
      sources.set(source, nextSource)
      // 封存之后的磁盘内容不能进入本次候选集合，也不能触发磁盘补扫。
      await writeFile(source, initialSource.replace('38rpx', '91rpx'))
      const prepared = await prepareTailwindRoots(compiler, {
        revision,
        changedFiles: [source],
        sources,
      }, roots, { cwd: root, sourceId: file => file })
      const actual = prepared.get('root')!
      expect(actual.rawCss).toBe(expected.rawCss)
      expect(actual.css).toBe(expected.css)
      expect([...actual.classSet].sort()).toEqual([...expected.classSet].sort())
      expect(actual.classSet.has('text-[91rpx]')).toBe(false)
      return actual
    }

    const scriptOnly = await prepare(initialSource.replace('const count = 1', 'const count = 2'), 1)
    expect(scriptOnly.rawCss).toBe(initial.rawCss)
    expect(scriptOnly.css).toBe(initial.css)

    const changed = await prepare(initialSource.replace('38rpx', '42rpx'), 2)
    expect(changed.classSet.has('text-[42rpx]')).toBe(true)
    expect(changed.classSet.has('text-[38rpx]')).toBe(false)
    expect(changed.css).toMatch(/font-size:\s*42rpx/)
    expect(changed.css).not.toBe(initial.css)

    const restored = await prepare(initialSource, 3)
    expect(restored.rawCss).toBe(initial.rawCss)
    expect(restored.css).toBe(initial.css)
    expect(restored.classSet.has('text-[38rpx]')).toBe(true)
    expect(restored.classSet.has('text-[42rpx]')).toBe(false)
  }
  finally {
    await Promise.all([compiler.dispose(), reference.dispose()])
    await rm(root, { recursive: true, force: true })
  }
})
