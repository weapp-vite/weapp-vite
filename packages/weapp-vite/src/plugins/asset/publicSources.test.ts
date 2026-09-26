import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { createPublicAssetSourcePlan } from './publicSources'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('collects custom public roots, arbitrary extensions and dot files without following output files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'public-asset-plan-'))
  roots.push(root)
  const publicDir = path.join(root, 'static')
  const outDir = path.join(publicDir, 'generated')
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(publicDir, '.metadata'), 'dot bytes')
  await writeFile(path.join(publicDir, 'config.js'), 'module.exports = {}')
  await writeFile(path.join(outDir, 'never-copy.txt'), 'generated')
  await mkdir(path.join(root, 'linked-source'))
  await writeFile(path.join(root, 'linked-source/raw.data'), 'linked bytes')
  await symlink(path.join(root, 'linked-source'), path.join(publicDir, 'linked'), 'junction')
  const plan = createPublicAssetSourcePlan({ publicDir, copyPublicDir: true }, outDir)
  expect((await plan.scan()).map(plan.outputName).sort()).toEqual(['.metadata', 'config.js', 'linked/raw.data'])
  expect(plan.matchesPath(path.join(root, 'static-other/file.txt'))).toBe(false)
  expect(plan.matchesPath(path.join(outDir, 'never-copy.txt'))).toBe(false)
  await rm(publicDir, { recursive: true })
  expect(await plan.scan()).toEqual([])
})

it.each([
  { publicDir: false as const, copyPublicDir: true },
  { publicDir: '', copyPublicDir: true },
  { publicDir: '/unused-public-root', copyPublicDir: false },
])('does not own disabled public sources: %j', async (options) => {
  const plan = createPublicAssetSourcePlan(options, '/unused-output-root')
  expect(plan.roots).toEqual([])
  expect(await plan.scan()).toEqual([])
  expect(plan.matchesPath('/unused-public-root/file.txt')).toBe(false)
})
