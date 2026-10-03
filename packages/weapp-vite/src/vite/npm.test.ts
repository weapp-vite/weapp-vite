import type { CompilerContext } from '../context'
import type { PackageBuildOutput } from '../runtime/npmPlugin/builder/output'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { prepareNpmAssets } from './npm'

const factory = vi.hoisted(() => vi.fn())
vi.mock('../runtime/npmPlugin/builder', () => ({ createPackageBuilder: factory }))

it('waits for every dependency after a failure before deleting the owned staging directory', async () => {
  const failure = new Error('broken dependency')
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let staging = ''
  let secondFinished = false
  let output!: PackageBuildOutput
  const builder = vi.fn(async ({ dep, outDir }: { dep: string, outDir: string }) => {
    staging = output.directory(outDir)
    if (dep === 'broken') {
      throw failure
    }
    await pending
    await mkdir(staging, { recursive: true })
    await writeFile(path.join(staging, 'output.js'), 'module.exports = {}')
    secondFinished = true
  })
  factory.mockImplementation((_ctx, _plugin, capture) => {
    output = capture
    return { buildPackage: builder }
  })
  const root = await mkdtemp(path.join(os.tmpdir(), 'npm-cleanup-test-'))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { broken: '*', delayed: '*' } }))
  const ctx = {
    configService: {
      cwd: root,
      platform: 'weapp',
      outDir: path.join(root, 'dist'),
      multiPlatform: { enabled: false },
      projectConfig: {},
      inlineConfig: {},
      weappViteConfig: { npm: { enable: true, strategy: 'legacy' } },
      packageJson: { dependencies: { broken: '*', delayed: '*' } },
    },
    scanService: { loadSubPackages() {}, subPackageMap: new Map() },
  } as unknown as CompilerContext
  let settled = false
  const result = prepareNpmAssets(ctx).finally(() => {
    settled = true
  })
  const rejected = expect(result).rejects.toBe(failure)
  try {
    await expect.poll(() => builder.mock.calls.length).toBe(2)
    expect(settled).toBe(false)
  }
  finally {
    release()
  }
  await rejected
  expect(secondFinished).toBe(true)
  await expect(stat(path.dirname(staging))).rejects.toMatchObject({ code: 'ENOENT' })
  await rm(root, { recursive: true, force: true })
})
