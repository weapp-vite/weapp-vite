import path from 'node:path'
import { glob } from 'tinyglobby'
import { loadConfigFromFile, mergeConfig } from 'vite'
import { describe, expect, it } from 'vitest'

describe('compiler test project partition', () => {
  it('executes the complete file set once while preserving watch tests in the serial project', async () => {
    const cwd = path.resolve(import.meta.dirname, '../packages/weapp-vite')
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(cwd, 'vitest.config.ts'))
    const config = loaded!.config as { test: { projects: Array<{ test: { name: string, include: string[], exclude: string[], fileParallelism?: boolean } }> } }
    const discovered = new Map<string, Set<string>>()
    for (const project of config.test.projects) {
      const resolved = mergeConfig(config, project).test
      discovered.set(project.test.name, new Set(await glob(resolved.include, { cwd, ignore: resolved.exclude })))
    }
    const fast = discovered.get('weapp-vite-fast')!
    const serial = discovered.get('weapp-vite-serial')!
    expect([...fast].filter(file => serial.has(file))).toEqual([])

    const expected = await glob(['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'], {
      cwd,
      ignore: ['**/node_modules/**', '**/dist/**', '**/dist-*/**', '**/.weapp-vite/**', '**/coverage/**'],
    })
    expect([...new Set([...fast, ...serial])].sort()).toEqual(expected.sort())
    expect(config.test.projects.find(project => project.test.name === 'weapp-vite-serial')?.test.fileParallelism).toBe(false)
    for (const file of expected.filter(file => file.startsWith('test/'))) {
      expect(serial.has(file), `${file} must retain serial execution`).toBe(true)
    }
    expect(serial.has('src/plugins/core/lifecycle/watch.test.ts')).toBe(true)
  })
})
