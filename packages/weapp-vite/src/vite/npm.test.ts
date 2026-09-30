import type { CompilerContext } from '../context'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { prepareNpmAssets } from './npm'

it('waits for every dependency after a failure before deleting the owned staging directory', async () => {
  const failure = new Error('broken dependency')
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let staging = ''
  let secondFinished = false
  const builder = vi.fn(async ({ dep, outDir }: { dep: string, outDir: string }) => {
    staging = outDir
    if (dep === 'broken') {
      throw failure
    }
    await pending
    await mkdir(outDir, { recursive: true })
    await writeFile(path.join(outDir, 'output.js'), 'module.exports = {}')
    secondFinished = true
  })
  const ctx = {
    configService: {
      weappViteConfig: { npm: { enable: true, strategy: 'legacy' } },
      packageJson: { dependencies: { broken: '*', delayed: '*' } },
    },
    scanService: { loadSubPackages() {}, subPackageMap: new Map() },
    npmService: { buildPackage: builder },
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
})
