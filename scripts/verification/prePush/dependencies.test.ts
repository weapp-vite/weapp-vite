import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { hasCandidateDependencies } from './dependencies.ts'

const roots = new Set<string>()
afterEach(async () => {
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

async function installation() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'push-dependencies-'))
  roots.add(root)
  const graph = 'lockfileVersion: "9.0"\nsettings: {}\nimporters:\n  .: {}\npackages: {}\n'
  await mkdir(path.join(root, 'node_modules/.pnpm'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@12.15.0' }))
  await writeFile(path.join(root, 'pnpm-lock.yaml'), `---\nlockfileVersion: "9.0"\nimporters: {}\n---\n${graph}`)
  await writeFile(path.join(root, 'node_modules/.pnpm/lock.yaml'), graph)
  await writeFile(path.join(root, 'node_modules/.modules.yaml'), JSON.stringify({ packageManager: 'pnpm@12.15.0', included: { dependencies: true, devDependencies: true, optionalDependencies: true } }))
  return root
}

it('recognizes the workspace document of a pnpm 12 lock rather than its package-manager document', async () => {
  expect(await hasCandidateDependencies(await installation())).toBe(true)
})

it('rejects stale, incomplete or unproven dependency installations', async () => {
  const root = await installation()
  await writeFile(path.join(root, 'node_modules/.pnpm/lock.yaml'), 'lockfileVersion: "9.0"\nimporters: {}\n')
  expect(await hasCandidateDependencies(root)).toBe(false)
  await rm(path.join(root, 'node_modules/.modules.yaml'))
  expect(await hasCandidateDependencies(root)).toBe(false)
  expect(await hasCandidateDependencies(path.join(root, 'missing'))).toBe(false)
})

it.each(['garbage', '[]', 'null', 'lockfileVersion: "9.0"\n', 'lockfileVersion: "9.0"\nimporters: []\n'])('rejects identical malformed lock documents instead of treating equality as installation proof', async (source) => {
  const root = await installation()
  await writeFile(path.join(root, 'pnpm-lock.yaml'), source)
  await writeFile(path.join(root, 'node_modules/.pnpm/lock.yaml'), source)
  expect(await hasCandidateDependencies(root)).toBe(false)
})
