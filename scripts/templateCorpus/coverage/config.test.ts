import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { loadConfigFromFile, transformWithOxc } from 'vite'
import { expect, it } from 'vitest'

interface SourceCoverageConfig {
  oxc?: Parameters<typeof transformWithOxc>[2]
  test: {
    include: string[]
    coverage: {
      include: string[]
      exclude: string[]
      thresholds: Record<string, number>
    }
  }
}

async function loadCoverageConfig() {
  const filename = path.resolve(import.meta.dirname, '../../../packages/wxml/vitest.coverage.config.ts')
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, filename)
  expect(loaded).not.toBeNull()
  return loaded!.config as SourceCoverageConfig
}

it('transforms source coverage imports without loading unrelated generated app tsconfigs', async () => {
  const config = await loadCoverageConfig()
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'wxml-source-coverage-config-')))
  try {
    await mkdir(path.join(root, 'apps/unused-app'), { recursive: true })
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      references: [{ path: './apps/unused-app' }],
      files: [],
    }))
    await writeFile(path.join(root, 'apps/unused-app/tsconfig.json'), JSON.stringify({
      extends: './.weapp-vite/tsconfig.shared.json',
    }))
    const file = path.join(root, 'scripts/templateCorpus/coverage/receipt.ts')
    const source = 'const receipt: { accepted: boolean } = { accepted: true }; globalThis.coverageReceipt = receipt'
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, source)

    await expect(transformWithOxc(source, file)).rejects.toThrow('tsconfig.shared.json')

    const result = await transformWithOxc(source, file, config.oxc)
    const context: { coverageReceipt?: unknown } = {}
    runInNewContext(result.code, context)
    expect(context.coverageReceipt).toEqual({ accepted: true })
    await expect(transformWithOxc('const invalid: number = ;', file, config.oxc)).rejects.toThrow()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves complete source coverage discovery and strict coverage gates', async () => {
  const config = await loadCoverageConfig()
  expect(config.test.include).toEqual(['src/**/*.test.ts', '../../scripts/templateCorpus/test/sourceCoverage.coverage.ts'])
  expect(config.test.coverage.include).toEqual(['src/**/*.ts'])
  expect(config.test.coverage.exclude).toEqual(['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts'])
  expect(config.test.coverage.thresholds).toEqual({ statements: 100, functions: 100, lines: 100, branches: 99 })
})
