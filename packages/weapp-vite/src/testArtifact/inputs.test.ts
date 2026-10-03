import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { fingerprintPaths, resolveArtifactOutDir } from './inputs'

const projects: string[] = []
afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => fs.rm(project, { recursive: true, force: true })))
})

it('invalidates same-length edits, new routes, removed outputs and external inputs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-inputs-'))
  projects.push(root)
  const source = path.join(root, 'src')
  const external = path.join(root, 'external.ts')
  await fs.mkdir(source)
  await fs.writeFile(path.join(source, 'page.ts'), 'one')
  await fs.writeFile(external, 'one')
  const paths = [source, external]
  const initial = await fingerprintPaths(paths)
  await fs.writeFile(path.join(source, 'page.ts'), 'two')
  expect(await fingerprintPaths(paths)).not.toBe(initial)
  await fs.writeFile(path.join(source, 'page.ts'), 'one')
  expect(await fingerprintPaths(paths)).toBe(initial)
  await fs.writeFile(path.join(source, 'new.ts'), 'new')
  expect(await fingerprintPaths(paths)).not.toBe(initial)
  await fs.rm(path.join(source, 'new.ts'))
  await fs.writeFile(external, 'two')
  expect(await fingerprintPaths(paths)).not.toBe(initial)
  await fs.rm(external)
  expect(await fingerprintPaths(paths)).not.toBe(initial)
})

it('ignores its own generated tree while inspecting project-root sources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-inputs-'))
  projects.push(root)
  const initial = await fingerprintPaths([root])
  await fs.mkdir(path.join(root, '.weapp-vite/test-artifacts'), { recursive: true })
  await fs.writeFile(path.join(root, '.weapp-vite/test-artifacts/output.js'), 'output')
  expect(await fingerprintPaths([root])).toBe(initial)
})

it('isolates configuration outputs and normalizes equivalent option objects', () => {
  const root = path.resolve('fixture')
  const initial = resolveArtifactOutDir(root, { configFile: './vite.config.ts', mode: 'test' }, 'generation')
  expect(resolveArtifactOutDir(root, { mode: 'test', configFile: 'vite.config.ts', skipNpm: false }, 'generation')).toBe(initial)
  expect(resolveArtifactOutDir(root, { configFile: 'other.config.ts' })).not.toBe(initial)
  expect(resolveArtifactOutDir(root, { mode: 'production' })).not.toBe(initial)
  expect(resolveArtifactOutDir(root, {})).not.toBe(resolveArtifactOutDir(root, {}))
  expect(resolveArtifactOutDir(root, { outDir: 'custom' })).toBe(path.join(root, 'custom'))
})
