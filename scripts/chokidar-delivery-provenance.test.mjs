import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 独立临时 Git 仓库用于核验真实来源与脏工作区门禁。
import { execa } from 'execa'
import { afterEach, expect, it } from 'vitest'
import { recordDeliveryProvenance } from './chokidar-delivery-provenance.mjs'

const roots = []
const digest = contents => createHash('sha256').update(contents).digest('hex')

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chokidar-provenance-'))
  roots.push(root)
  const sourceRoot = path.join(root, 'source')
  const tarballRoot = path.join(root, 'tarballs')
  await mkdir(path.join(sourceRoot, 'node_modules'), { recursive: true })
  await mkdir(tarballRoot)
  await writeFile(path.join(sourceRoot, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@12.11.2' }))
  await writeFile(path.join(sourceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
  await execa('git', ['init', '--quiet'], { cwd: sourceRoot })
  await execa('git', ['add', 'package.json', 'pnpm-lock.yaml'], { cwd: sourceRoot })
  await execa('git', ['-c', 'user.name=Provenance Test', '-c', 'user.email=provenance@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: sourceRoot })
  const expectedSha = (await execa('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot })).stdout.trim()
  await writeFile(path.join(tarballRoot, 'weapp-vite.tgz'), 'opaque archive bytes')
  await writeFile(path.join(tarballRoot, 'consumer-tarballs.json'), JSON.stringify({ schemaVersion: 1, packages: { 'weapp-vite': { file: 'weapp-vite.tgz', version: '1.0.0' } } }))
  return { sourceRoot, tarballRoot, expectedSha, variant: 'baseline' }
}

it('binds actual source identity and independent archive bytes without leaking checkout paths', async () => {
  const input = await fixture()
  const report = await recordDeliveryProvenance(input)
  expect(report).toMatchObject({ sourceSha: input.expectedSha, variant: 'baseline', trackedSourceClean: true, independentNodeModules: true })
  expect(report.archives).toEqual([{ name: 'weapp-vite', file: 'weapp-vite.tgz', bytes: 20, sha256: digest('opaque archive bytes') }])
  expect(report.lockfileSha256).toBe(digest(await readFile(path.join(input.sourceRoot, 'pnpm-lock.yaml'))))
  expect(JSON.stringify(report)).not.toContain(input.sourceRoot)
})

it('rejects a different frozen commit and changed original source before recording provenance', async () => {
  const input = await fixture()
  await expect(recordDeliveryProvenance({ ...input, expectedSha: '0'.repeat(40) })).rejects.toThrow('frozen source')
  await writeFile(path.join(input.sourceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: changed\n')
  await expect(recordDeliveryProvenance(input)).rejects.toThrow('tracked modifications')
})
