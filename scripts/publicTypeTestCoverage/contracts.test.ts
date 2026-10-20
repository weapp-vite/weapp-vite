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
