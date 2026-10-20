import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { collectContracts } from './contracts'

it('expands aliases in their owning directory and keeps nested cd local to that alias', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-alias-'))
  try {
    await mkdir(path.join(root, 'test-d-pure/nested'), { recursive: true })
    await mkdir(path.join(root, 'test-d'))
    await writeFile(path.join(root, 'package.json'), JSON.stringify({
      scripts: {
        'test:types:pure': 'cd test-d-pure && pnpm run contracts',
        'contracts': 'node forbidden-root-command.mjs',
      },
    }))
    await writeFile(path.join(root, 'test-d-pure/package.json'), JSON.stringify({ scripts: { contracts: 'tsd --files "**/*.test-d.ts"' } }))
    await writeFile(path.join(root, 'test-d-pure/nested/pure.test-d.ts'), '')
    await writeFile(path.join(root, 'test-d/public.test-d.ts'), '')
    expect(await collectContracts(root, 'pnpm run test:types:pure && tsd --files "test-d/**/*.test-d.ts"')).toEqual([
      'test-d-pure/nested/pure.test-d.ts',
      'test-d/public.test-d.ts',
    ])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects a pure alias that drops every real contract', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-missing-'))
  try {
    await mkdir(path.join(root, 'test-d-pure'))
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'test:types:pure': 'cd test-d-pure && tsd --files "missing.test-d.ts"' } }))
    await writeFile(path.join(root, 'test-d-pure/package.json'), JSON.stringify({ scripts: {} }))
    await writeFile(path.join(root, 'test-d-pure/public.test-d.ts'), '')
    await expect(collectContracts(root, 'pnpm run test:types:pure')).rejects.toThrow('must select real contracts')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('selects isolated host programs by positional package directory without changing later command scope', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-host-'))
  try {
    await mkdir(path.join(root, 'test-d-host'))
    await mkdir(path.join(root, 'test-d-pure'))
    await mkdir(path.join(root, 'test-d'))
    await writeFile(path.join(root, 'package.json'), JSON.stringify({
      scripts: {
        'test:types:host': 'tsd test-d-host --files root.test-d.ts && tsd test-d-host --files internal-runtime.test-d.ts',
        'test:types:pure': 'cd test-d-pure && tsd --files "**/*.test-d.ts"',
      },
    }))
    for (const directory of ['test-d-host', 'test-d-pure']) {
      await writeFile(path.join(root, directory, 'package.json'), JSON.stringify({ scripts: {} }))
    }
    const contracts = ['test-d-host/root.test-d.ts', 'test-d-host/internal-runtime.test-d.ts', 'test-d-pure/config.test-d.ts', 'test-d/public.test-d.ts']
    for (const file of contracts) {
      await writeFile(path.join(root, file), '')
    }
    expect(await collectContracts(root, 'pnpm run test:types:host && pnpm run test:types:pure && tsd --files "test-d/**/*.test-d.ts"')).toEqual(contracts.sort())
    expect(await collectContracts(root, 'tsd test-d-host --files root.test-d.ts')).toEqual(['test-d-host/root.test-d.ts'])
    expect(await collectContracts(root, 'tsd test-d-host --files internal-runtime.test-d.ts')).toEqual(['test-d-host/internal-runtime.test-d.ts'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { file: 'index.test-d.ts', manifest: { types: 'index.d.ts', scripts: {} } },
  { file: 'contracts/nested/public.test-d.ts', manifest: { types: 'index.d.ts', scripts: {}, tsd: { directory: 'contracts' } } },
])('uses the selected package manifest for positional tsd defaults: $file', async ({ file, manifest }) => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-default-'))
  try {
    const host = path.join(root, 'test-d-host')
    await mkdir(path.dirname(path.join(host, file)), { recursive: true })
    await writeFile(path.join(host, 'package.json'), JSON.stringify(manifest))
    await writeFile(path.join(host, file), '')
    expect(await collectContracts(root, 'tsd test-d-host')).toEqual([`test-d-host/${file}`])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('selects every repeated files option and rejects a missing selection instead of ignoring it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-files-'))
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }))
    await writeFile(path.join(root, 'root.test-d.ts'), '')
    await writeFile(path.join(root, 'internal-runtime.test-d.ts'), '')
    expect(await collectContracts(root, 'tsd --files root.test-d.ts --files internal-runtime.test-d.ts')).toEqual(['internal-runtime.test-d.ts', 'root.test-d.ts'])
    await expect(collectContracts(root, 'tsd --files root.test-d.ts --files missing.test-d.ts')).rejects.toThrow('must select real contracts for every files option')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { command: 'tsd .. --files public.test-d.ts', error: 'cannot escape the package' },
  { command: 'tsd --files ../public.test-d.ts', error: 'cannot escape the package' },
  { command: 'tsd --typings ../index.d.ts', error: 'cannot escape the package' },
  { command: 'tsd first second --files public.test-d.ts', error: 'additional positional directory' },
  { command: 'tsd --unknown public.test-d.ts', error: 'Unsupported tsd option' },
  { command: 'tsd --files', error: 'Missing value for tsd option' },
  { command: 'tsd --files --typings index.d.ts', error: 'Missing value for tsd option' },
  { command: 'tsd --typings index.d.ts --typings other.d.ts', error: 'Duplicate tsd typings option' },
])('rejects unmodeled or escaping tsd selections: $command', async ({ command, error }) => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-tsd-'))
  try {
    await expect(collectContracts(root, command)).rejects.toThrow(error)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([
  { scripts: {}, command: 'pnpm run absent', error: 'Missing type contract alias' },
  { scripts: { check: 'pnpm run check' }, command: 'pnpm run check', error: 'Cyclic type contract alias' },
  { scripts: { first: 'pnpm run second', second: 'pnpm run first' }, command: 'pnpm run first', error: 'Cyclic type contract alias' },
  { scripts: { check: 'pnpm build' }, command: 'pnpm run check', error: 'Only pnpm run aliases' },
  { scripts: { check: 'node build.mjs' }, command: 'pnpm run check', error: 'only select and run tsd' },
  { scripts: { check: 'tsd' }, command: 'pnpm run check --filter=other', error: 'cannot accept additional arguments' },
  { scripts: { check: 'tsd', precheck: 'node build.mjs' }, command: 'pnpm run check', error: 'cannot run lifecycle hooks' },
  { scripts: { check: 'tsd', postcheck: 'node build.mjs' }, command: 'pnpm run check', error: 'cannot run lifecycle hooks' },
  { scripts: { check: 'cd .. && tsd' }, command: 'pnpm run check', error: 'cannot escape the package' },
])('rejects incomplete or unsafe alias graphs: $command / $error', async ({ scripts, command, error }) => {
  const root = await mkdtemp(path.join(tmpdir(), 'type-contract-graph-'))
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts }))
    await expect(collectContracts(root, command)).rejects.toThrow(error)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
