import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { afterEach, describe, expect, it } from 'vitest'

interface RuntimeContextModule {
  consumerRuntimeContexts: (manifest: Record<string, unknown>) => Map<string, unknown>
  expectedErrorConsumerSource: (specifier: string, context: { name: string, message: string }) => string
  vitestConsumerInvocation: (specifier: string, directory: string, installed?: string) => Promise<string[]>
  consumerOptionalPeers: (closure: {
    known: Map<string, { name: string, version: string }>
    references: {
      manifest: Record<string, unknown>
      reference: { field: string, alias: string, range: string, protocol: string }
      name: string
    }[]
  }, locators?: Map<string, string>) => Record<string, string>
}

const require = createRequire(import.meta.url)
const toolkit = createRequire(require.resolve('repoctl')).resolve('@icebreakers/monorepo')
const { consumerOptionalPeers, consumerRuntimeContexts, expectedErrorConsumerSource, vitestConsumerInvocation } = await import(new URL('./consumer-context.mjs', pathToFileURL(toolkit)).href) as RuntimeContextModule
const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('repoctl checked workspace peers', () => {
  const host = { name: '@fixture/host', version: '1.2.0' }
  const locators = new Map([[host.name, 'file:checked-host.tgz']])
  const peer = (alias = host.name, range = '^1.0.0', name = host.name, optional = false, field = 'peerDependencies') => ({
    manifest: { peerDependenciesMeta: { [alias]: { optional } } },
    reference: { field, alias, range, protocol: 'registry' },
    name,
  })
  const closure = (...references: ReturnType<typeof peer>[]) => ({ known: new Map([[host.name, host]]), references })

  it('installs required local peers from the checked tarball, including aliases and transitive peers', () => {
    expect(consumerOptionalPeers(closure(peer(), peer('host-alias', '>=1.1.0 <2')), locators)).toEqual({
      [host.name]: 'file:checked-host.tgz',
      'host-alias': 'file:checked-host.tgz',
    })
    expect(consumerOptionalPeers(closure(peer()), new Map([[host.name, 'npm:@fixture/host@snapshot-nightly']]))).toEqual({
      [host.name]: 'npm:@fixture/host@snapshot-nightly',
    })
  })

  it('preserves external optional peers and leaves external required and development dependencies unchanged', () => {
    expect(consumerOptionalPeers(closure(
      peer('optional', '^5.0.0', 'optional', true),
      peer('required', '^5.0.0', 'required'),
      peer(host.name, '^1.0.0', host.name, false, 'devDependencies'),
    ), locators)).toEqual({ optional: '^5.0.0' })
  })

  it('still rejects incompatible checked versions, missing tarballs and alias conflicts', () => {
    expect(() => consumerOptionalPeers(closure(peer(host.name, '^2.0.0')), locators)).toThrow('does not accept checked workspace package')
    expect(() => consumerOptionalPeers(closure(peer()), new Map())).toThrow('no checked tarball')
    expect(() => consumerOptionalPeers(closure(peer(), peer(host.name, '^1.0.0', '@fixture/other')), locators)).toThrow('conflicting package names')
    expect(() => consumerOptionalPeers(closure(peer(), peer(host.name, '^2.0.0')), locators)).toThrow('incompatible declared ranges')
  })
})

async function fixture() {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'consumer-context-')))
  directories.push(directory)
  const vitest = path.join(directory, 'node_modules/vitest')
  await mkdir(vitest, { recursive: true })
  await Promise.all([
    writeFile(path.join(directory, 'package.json'), '{"private":true}'),
    writeFile(path.join(vitest, 'package.json'), JSON.stringify({
      name: 'vitest',
      version: '5.0.5',
      bin: { vitest: './vitest.mjs' },
      exports: { '.': { import: './index.mjs', require: './index.cjs' }, './package.json': './package.json' },
    })),
    writeFile(path.join(vitest, 'vitest.mjs'), ''),
    writeFile(path.join(vitest, 'index.mjs'), ''),
  ])
  return directory
}

describe('repoctl framework consumer context', () => {
  it('preserves the default Node context unless an exact framework setup is declared', () => {
    expect(consumerRuntimeContexts({})).toEqual(new Map())
    expect(consumerRuntimeContexts({
      peerDependencies: { vitest: '>=4.0.0' },
      repoctl: { packageCheck: { runtimeContexts: { './vitest/setup': 'vitest' } } },
    })).toEqual(new Map([['./vitest/setup', 'vitest']]))
  })

  it.each([
    null,
    [],
    'vitest',
    { './*': 'vitest' },
    { './a/../setup': 'vitest' },
    { './a\\setup': 'vitest' },
    { './setup': 'node' },
    { setup: 'vitest' },
    { './guard': { kind: 'expected-error', name: 'Error', message: '' } },
    { './guard': { kind: 'expected-error', name: 'Error', message: 'guard', skip: true } },
  ])('rejects invalid context metadata %j', (runtimeContexts) => {
    expect(() => consumerRuntimeContexts({
      dependencies: { vitest: '^5.0.5' },
      repoctl: { packageCheck: { runtimeContexts } },
    })).toThrow()
  })

  it('requires the framework to be a published dependency or peer', () => {
    expect(() => consumerRuntimeContexts({
      devDependencies: { vitest: '^5.0.5' },
      repoctl: { packageCheck: { runtimeContexts: { './setup': 'vitest' } } },
    })).toThrow('declared Vitest dependency or peer')
  })

  it('accepts exact unavailable-runtime contracts without a framework dependency', () => {
    const context = { kind: 'expected-error', name: 'Error', message: 'requires its build plugin' }
    expect(consumerRuntimeContexts({
      repoctl: { packageCheck: { runtimeContexts: { './guard': context } } },
    })).toEqual(new Map([['./guard', context]]))
  })

  it('imports guarded entries and rejects success or a different failure', async () => {
    const message = 'requires its build plugin'
    const context = { name: 'Error', message }
    const source = (body: string) => expectedErrorConsumerSource(`data:text/javascript,${encodeURIComponent(body)}`, context)
    const run = (body: string) => vm.runInThisContext(`(async () => {${source(body)}})()`, {
      importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    }) as Promise<void>
    await expect(run(`throw new Error(${JSON.stringify(message)})`)).resolves.toBeUndefined()
    await expect(run('export const routes = []')).rejects.toThrow('declared unavailable-runtime error')
    await expect(run('throw new Error("different failure")')).rejects.toThrow('declared unavailable-runtime error')
    await expect(run(`throw new TypeError(${JSON.stringify(message)})`)).rejects.toThrow('declared unavailable-runtime error')
  })

  it('runs the installed CLI with the setup as a real Vitest setup file', async () => {
    const directory = await fixture()
    const args = await vitestConsumerInvocation('@fixture/api/vitest/setup', directory)
    expect(args.slice(0, 3)).toEqual([path.join(directory, 'node_modules/vitest/vitest.mjs'), 'run', '--config'])
    const source = await readFile(args[3]!, 'utf8')
    const config = JSON.parse(source.slice('export default '.length, -2)) as {
      root: string
      test: { setupFiles: string[], include: string[], passWithNoTests: boolean, watch: boolean }
    }
    expect(config.root).toBe(directory)
    expect(config.test.setupFiles).toEqual(['@fixture/api/vitest/setup'])
    expect(config.test.passWithNoTests).toBe(false)
    expect(config.test.watch).toBe(false)
    expect(await readFile(path.join(directory, config.test.include[0]!), 'utf8')).toContain(pathToFileURL(path.join(directory, 'node_modules/vitest/index.mjs')).href)
  })

  it('refuses a framework resolved from an ancestor outside the isolated consumer', async () => {
    const parent = await fixture()
    const consumer = path.join(parent, 'consumer')
    await mkdir(consumer)
    await writeFile(path.join(consumer, 'package.json'), '{"private":true}')
    await expect(vitestConsumerInvocation('@fixture/api/setup', consumer)).rejects.toThrow('outside its isolated directory')
  })
})
