import type { OutputOptions } from 'rolldown'
import type { InlineConfig, Plugin } from 'vite'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resolveConfig } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { createSnapshotBuildConfig } from './snapshotConfig'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function groups(output: OutputOptions | OutputOptions[] | undefined) {
  if (Array.isArray(output) || !output || typeof output.codeSplitting !== 'object') {
    throw new Error('Expected one output with explicit code splitting groups')
  }
  return output.codeSplitting.groups
}

it('keeps inherited alias and output rules constant across real Vite config resolutions for every environment', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapshot-config-'))
  roots.push(root)
  const plugin: Plugin = { name: 'snapshot-config-observer' }
  const name = () => 'shared'
  const sharedGroup = { name, minShareCount: 1 }
  const extraGroup = { name: 'server-only', minShareCount: 2 }
  // 重复项本身可以表达优先级；修复必须隔离配置写回，不能擅自去重用户规则。
  const aliases = [
    { find: 'shared-entry', replacement: path.join(root, 'primary.ts') },
    { find: 'shared-entry', replacement: path.join(root, 'fallback.ts') },
  ]
  const globalGroups = [sharedGroup, sharedGroup]
  const options: InlineConfig = {
    root,
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    plugins: [plugin],
    resolve: { alias: aliases },
    build: { rolldownOptions: { output: { codeSplitting: { groups: globalGroups } } } },
    environments: {
      client: {},
      ssr: { resolve: { conditions: ['ssr-custom'] }, build: { rolldownOptions: { output: { codeSplitting: { groups: [extraGroup] } } } } },
      edge: { consumer: 'server', resolve: { conditions: ['edge-custom'] } },
    },
  }
  const environments = options.environments!
  for (let iteration = 0; iteration < 4; iteration++) {
    const input = createSnapshotBuildConfig(options)
    const resolved = await resolveConfig(input, 'build')
    const clientResolve = input.environments!.client!.resolve as InlineConfig['resolve']
    expect(clientResolve?.alias).toEqual(aliases)
    for (const environment of ['client', 'ssr', 'edge']) {
      const expected = environment === 'ssr' ? [...globalGroups, extraGroup] : globalGroups
      const actual = groups(resolved.environments[environment]!.build.rolldownOptions.output)
      expect(actual).toEqual(expected)
      expect(actual?.[0]?.name).toBe(name)
      expect(resolved.environments[environment]!.resolve.alias.filter(alias => alias.find === 'shared-entry')).toEqual(aliases)
    }
    expect(resolved.plugins.find(item => item.name === plugin.name)).toBe(plugin)
    expect(options.environments).toBe(environments)
    expect(environments.client).toEqual({})
    expect(environments.ssr!.resolve).toEqual({ conditions: ['ssr-custom'] })
    expect(groups(environments.ssr!.build!.rolldownOptions!.output)).toEqual([extraGroup])
    expect(environments.edge).toEqual({ consumer: 'server', resolve: { conditions: ['edge-custom'] } })
    expect(options.resolve).toEqual({ alias: aliases })
    expect(groups(options.build!.rolldownOptions!.output)).toEqual(globalGroups)
  }
})

it('isolates real Vite compatibility and warmup writes while retaining plugin and callback identities', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapshot-config-'))
  roots.push(root)
  const plugin: Plugin = { name: 'shared-user-plugin' }
  const createEnvironment = () => {
    throw new Error('Not launched during config ownership verification')
  }
  const customResolver = () => null
  const rolldownPlugins = [plugin]
  const options: InlineConfig = {
    root,
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    plugins: [plugin],
    resolve: { alias: [{ find: 'shared-entry', replacement: 'replacement', customResolver }] },
    build: { rolldownOptions: { plugins: rolldownPlugins } },
    optimizeDeps: { noDiscovery: true },
    worker: { plugins: () => [plugin] },
    ssr: { optimizeDeps: { noDiscovery: true } },
    server: { warmup: { clientFiles: ['warmup-client.ts'], ssrFiles: ['warmup-ssr.ts'] } },
    environments: {
      client: { dev: { createEnvironment, warmup: ['entry.ts'] }, optimizeDeps: { noDiscovery: true } },
      ssr: { dev: { warmup: ['ssr-entry.ts'] } },
      edge: { build: { createEnvironment, rolldownOptions: { plugins: rolldownPlugins } }, resolve: { conditions: ['edge'] } },
    },
  }
  for (const environment of Object.values(options.environments!)) {
    for (const value of [environment.dev, environment.build, environment.resolve, environment.optimizeDeps]) {
      if (value) {
        Object.freeze(value)
      }
    }
    Object.freeze(environment)
  }
  for (const value of [options.environments, options.resolve, options.build, options.optimizeDeps, options.worker, options.ssr!.optimizeDeps, options.ssr, options]) {
    Object.freeze(value)
  }
  const input = createSnapshotBuildConfig(options)
  const resolved = await resolveConfig(input, 'build')
  expect(input.plugins?.[0]).toBe(plugin)
  expect(input.build!.rolldownOptions!.plugins).toBe(rolldownPlugins)
  expect(input.environments!.edge!.build!.createEnvironment).toBe(createEnvironment)
  expect(input.environments!.client!.dev!.createEnvironment).toBe(createEnvironment)
  expect(input.resolve!.alias).toBe(options.resolve!.alias)
  expect(input.worker!.plugins).toBe(options.worker!.plugins)
  expect(resolved.environments.client!.dev.warmup).toEqual(['warmup-client.ts'])
  expect(resolved.environments.ssr!.dev.warmup).toEqual(['warmup-ssr.ts'])
  expect(options.environments!.client!.dev!.warmup).toEqual(['entry.ts'])
  expect(options.environments!.ssr!.dev!.warmup).toEqual(['ssr-entry.ts'])
  expect(options.environments!.edge!.resolve!.conditions).toEqual(['edge'])
  expect(options.environments!.edge!.build!.rolldownOptions!.plugins).toBe(rolldownPlugins)
  expect(options.build!.rolldownOptions!.plugins).toBe(rolldownPlugins)
  expect(options.optimizeDeps!.noDiscovery).toBe(true)
  expect(options.ssr!.optimizeDeps!.noDiscovery).toBe(true)
})

it('does not persist implicitly created environments into the reusable snapshot config', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'snapshot-config-'))
  roots.push(root)
  const options: InlineConfig = { root, configFile: false, envDir: false, logLevel: 'silent' }
  for (let iteration = 0; iteration < 2; iteration++) {
    const resolved = await resolveConfig(createSnapshotBuildConfig(options), 'build')
    expect(Object.keys(resolved.environments)).toEqual(['client'])
    expect(options).toEqual({ root, configFile: false, envDir: false, logLevel: 'silent' })
  }
})
