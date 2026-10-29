import path from 'node:path'
import { glob } from 'tinyglobby'
import { loadConfigFromFile, mergeConfig } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { createFastTestIncludes, nativeWatchContractTests, parallelFixtureTests, serialFixtureTestIncludes } from '../packages/weapp-vite/vitest/partition'
import { useIsolatedTopologyTestEnvironment } from './verification/topologyTestFixture.ts'

useIsolatedTopologyTestEnvironment()

describe('compiler test project partition', () => {
  it('keeps newly declared discovery roots in the fast partition without moving unaudited fixtures', () => {
    const includes = createFastTestIncludes([
      ...serialFixtureTestIncludes,
      'src/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.ts',
      'tools/**/*.{test,spec}.ts',
    ])
    expect(includes).toContain('src/**/*.{test,spec}.ts')
    expect(includes).toContain('scripts/**/*.{test,spec}.ts')
    expect(includes).toContain('tools/**/*.{test,spec}.ts')
    for (const pattern of serialFixtureTestIncludes) {
      expect(includes).not.toContain(pattern)
    }
    for (const file of parallelFixtureTests) {
      expect(includes).toContain(file)
    }
  })

  it('assigns the complete file set once across unit projects and the explicit native watcher entry', async () => {
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
    const nativeConfig = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(cwd, 'vitest.watch-native.config.ts'))
    const nativeOptions = nativeConfig!.config.test as { include: string[], globalSetup: string[], pool: string, maxWorkers: number, fileParallelism: boolean, sequence: { concurrent: boolean, shuffle: boolean }, allowOnly: boolean }
    const native = new Set(await glob(nativeOptions.include, { cwd }))
    expect([...fast].filter(file => serial.has(file))).toEqual([])
    expect([...native].sort()).toEqual([...nativeWatchContractTests].sort())
    expect([...native].filter(file => fast.has(file) || serial.has(file))).toEqual([])
    expect(nativeOptions).toMatchObject({ pool: 'forks', maxWorkers: 1, fileParallelism: false, sequence: { concurrent: false, shuffle: false }, allowOnly: false })
    expect(nativeOptions.globalSetup).toEqual([path.resolve(cwd, '../../e2e/vitest.e2e.machine-lease.global-setup.ts')])

    const expected = await glob(['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'], {
      cwd,
      ignore: ['**/node_modules/**', '**/dist/**', '**/dist-*/**', '**/.weapp-vite/**', '**/coverage/**'],
    })
    expect([...new Set([...fast, ...serial, ...native])].sort()).toEqual(expected.sort())
    expect(config.test.projects.find(project => project.test.name === 'weapp-vite-serial')?.test.fileParallelism).toBe(false)
    for (const file of expected.filter(file => file.startsWith('test/'))) {
      if (parallelFixtureTests.includes(file)) {
        expect(fast.has(file), `${file} has isolated inputs`).toBe(true)
      }
      else {
        expect(serial.has(file), `${file} must retain serial execution`).toBe(true)
      }
    }
    expect(serial.has('src/plugins/core/lifecycle/watch.test.ts')).toBe(true)
    expect(fast.has('scripts/watcherComparison/fileWatcher.lifecycle.test.ts')).toBe(true)
    expect(fast.has('scripts/watcherComparison/fileWatcher.targets.test.ts')).toBe(true)
    expect(fast.has('scripts/watcherComparison/state.test.ts')).toBe(true)
    expect(native.has('scripts/watcherComparison/fileWatcher.contract.test.ts')).toBe(true)
    expect(fast.has('scripts/chokidarDelivery/validation.test.ts')).toBe(true)
    expect(serial.has('scripts/chokidarDelivery/validation.test.ts')).toBe(false)
  })
})

it('keeps the complete discovered fixture union and final setup placement in every topology', async () => {
  const cwd = path.resolve(import.meta.dirname, '../packages/weapp-vite')
  const inventories = []
  const setups = []
  try {
    for (const topology of ['legacy-v1', 'optimized-v1', 'optimized-v2']) {
      vi.stubEnv('WEAPP_VITE_VERIFICATION_TOPOLOGY', topology)
      const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(cwd, 'vitest.config.ts'))
      const config = loaded!.config as { test: { projects: Array<{ test: { name: string, include: string[], exclude: string[], globalSetup?: string[], fileParallelism?: boolean } }> } }
      const projects = await Promise.all(config.test.projects.map(async project => ({
        ...project.test,
        files: await glob(mergeConfig(config, project).test.include, { cwd, ignore: mergeConfig(config, project).test.exclude }),
      })))
      const fast = projects.find(project => project.name === 'weapp-vite-fast')!
      const serial = projects.find(project => project.name === 'weapp-vite-serial')!
      expect(fast.files.filter(file => serial.files.includes(file))).toEqual([])
      expect(serial.fileParallelism).toBe(false)
      expect(serial.files).toContain('src/plugins/core/lifecycle/watch.test.ts')
      expect(nativeWatchContractTests.every(file => !fast.files.includes(file) && !serial.files.includes(file))).toBe(true)
      expect(parallelFixtureTests.every(file => topology === 'legacy-v1' ? serial.files.includes(file) && !fast.files.includes(file) : fast.files.includes(file) && !serial.files.includes(file))).toBe(true)
      inventories.push([...fast.files, ...serial.files].sort())
      setups.push(projects.map(project => project.globalSetup ?? []))
    }
    expect(inventories[0]).toEqual(inventories[1])
    expect(inventories[0]).toEqual(inventories[2])
    expect(setups[0]).toEqual(setups[1])
    expect(setups[0]).toEqual(setups[2])
    expect(setups[0]?.[0]).toEqual([])
    expect(setups[0]?.[1]).toEqual([path.resolve(cwd, '../../vitest.globalSetup.mjs')])
  }
  finally {
    vi.unstubAllEnvs()
  }
})
