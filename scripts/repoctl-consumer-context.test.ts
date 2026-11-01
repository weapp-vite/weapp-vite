import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import vm from 'node:vm'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'

interface ConsumerEntry {
  subpath: string
  target: string
  format: 'esm' | 'cjs'
  runtime: boolean
}

interface RuntimeContextModule {
  consumerRuntimeContexts: (manifest: Record<string, unknown>) => Map<string, unknown>
  expectedErrorConsumerSource: (specifier: string, context: { name: string, message: string }) => string
  vitestConsumerInvocation: (entry: ConsumerEntry, specifier: string, directory: string, installed: string) => Promise<string[]>
  checkInstalledEntries: (manifest: Record<string, unknown>, files: string[], installed: string, directory: string, run: (command: string, args: string[]) => Promise<void>, index: number) => Promise<void>
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

async function installedConsumerContracts(): Promise<RuntimeContextModule> {
  const directory = path.dirname(toolkit)
  const sources = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.mjs')).map(name => readFile(path.join(directory, name), 'utf8')))
  const candidates = sources.filter(source => source.includes('//#region src/commands/package-check/consumer/runtime-contexts/index.ts'))
  expect(candidates).toHaveLength(1)
  const source = candidates[0]!
  const regions = ['package-check/consumer/runtime-assets', 'package-check/consumer/runtime-contexts/source', 'package-check/consumer/runtime-contexts/vitest', 'package-check/consumer/runtime-contexts/index', 'package-check/entries', 'package-check/consumer/optional-peers', 'release/nightly/consumer/entries']
  const code = regions.map((region) => {
    const marker = `//#region src/commands/${region}.ts\n`
    const start = source.indexOf(marker)
    const end = source.indexOf('//#endregion', start + marker.length)
    expect(start, `Installed repoctl contract boundary: ${region}`).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    return source.slice(start + marker.length, end)
  }).join('\n')
  const globals: Record<string, unknown> = {}
  const parsed = ts.createSourceFile('installed.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('node:') && specifier !== 'semver') {
      continue
    }
    const imported = createRequire(toolkit)(specifier) as Record<string, unknown>
    const clause = statement.importClause
    if (clause?.name) {
      globals[clause.name.text] = imported
    }
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        globals[element.name.text] = imported[element.propertyName?.text ?? element.name.text]
      }
    }
  }
  return vm.compileFunction(`"use strict";\n${code}\nreturn { consumerOptionalPeers, consumerRuntimeContexts, expectedErrorConsumerSource, vitestConsumerInvocation, checkInstalledEntries };`, Object.keys(globals))(...Object.values(globals)) as RuntimeContextModule
}

const { consumerOptionalPeers, consumerRuntimeContexts, expectedErrorConsumerSource, vitestConsumerInvocation, checkInstalledEntries } = await installedConsumerContracts()
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

const setupEntry: ConsumerEntry = { subpath: './setup', target: './setup.mjs', format: 'esm', runtime: true }

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
    await Promise.all([
      writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: '@fixture/api', exports: { './setup': './setup.mjs' } })),
      writeFile(path.join(directory, 'setup.mjs'), 'export const setup = true'),
      writeFile(path.join(directory, 'node_modules/vitest/vitest.mjs'), 'console.log(JSON.stringify(process.argv))'),
    ])
    const args = await vitestConsumerInvocation(setupEntry, '@fixture/api/setup', directory, directory)
    expect(args).toHaveLength(1)
    const runner = await readFile(args[0]!, 'utf8')
    const { stdout } = await promisify(execFile)(process.execPath, args, { cwd: directory })
    const argv = JSON.parse(stdout) as string[]
    expect(argv.slice(0, 4)).toEqual([process.execPath, path.join(directory, 'node_modules/vitest/vitest.mjs'), 'run', '--config'])
    expect(runner).toContain('Exported runtime asset does not resolve to its checked package file.')
    expect(runner).toContain(pathToFileURL(path.join(directory, 'node_modules/vitest/vitest.mjs')).href)
    const source = await readFile(argv[4]!, 'utf8')
    const config = JSON.parse(source.slice('export default '.length, -2)) as {
      root: string
      test: { setupFiles: string[], include: string[], passWithNoTests: boolean, watch: boolean }
    }
    expect(config.root).toBe(directory)
    expect(config.test.setupFiles).toEqual(['@fixture/api/setup'])
    expect(config.test.passWithNoTests).toBe(false)
    expect(config.test.watch).toBe(false)
    expect(await readFile(path.join(directory, config.test.include[0]!), 'utf8')).toContain(pathToFileURL(path.join(directory, 'node_modules/vitest/index.mjs')).href)
  })

  it('refuses a framework resolved from an ancestor outside the isolated consumer', async () => {
    const parent = await fixture()
    const consumer = path.join(parent, 'consumer')
    await mkdir(consumer)
    await writeFile(path.join(consumer, 'package.json'), '{"private":true}')
    await expect(vitestConsumerInvocation(setupEntry, '@fixture/api/setup', consumer, consumer)).rejects.toThrow('outside its isolated directory')
  })

  it('uses the same runtime contracts in the installed consumer path and validates packed entry targets', async () => {
    const directory = await fixture()
    const context = { kind: 'expected-error', name: 'Error', message: 'requires its build plugin' }
    const manifest = {
      name: '@fixture/api',
      type: 'module',
      exports: { './setup': './setup.mjs', './guard': './guard.mjs' },
      peerDependencies: { vitest: '^5.0.5' },
      repoctl: { packageCheck: { runtimeContexts: { './setup': 'vitest', './guard': context } } },
    }
    await Promise.all([
      writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest)),
      writeFile(path.join(directory, 'setup.mjs'), 'export const setup = true'),
      writeFile(path.join(directory, 'guard.mjs'), `throw new Error(${JSON.stringify(context.message)})`),
    ])
    const invocations: { command: string, args: string[] }[] = []
    const run = async (command: string, args: string[]) => {
      invocations.push({ command, args })
      await promisify(execFile)(command, args, { cwd: directory })
    }
    await checkInstalledEntries(manifest, ['setup.mjs', 'guard.mjs'], directory, directory, run, 0)
    expect(invocations).toHaveLength(2)
    expect(invocations.every(invocation => invocation.command === process.execPath)).toBe(true)
    expect(await readFile(invocations[0]!.args[0]!, 'utf8')).toContain('"@fixture/api/setup"')
    expect(invocations[1]!.args.slice(0, 3)).toEqual(['--input-type', 'module', '--eval'])
    expect(invocations[1]!.args[3]).toContain(expectedErrorConsumerSource('@fixture/api/guard', context))
    expect(invocations[1]!.args[3]).toContain('Exported runtime asset does not resolve to its checked package file.')
    invocations.length = 0
    await expect(checkInstalledEntries(manifest, ['guard.mjs'], directory, directory, run, 0)).rejects.toThrow('packed ESM export')
    expect(invocations).toEqual([])
  })
})
