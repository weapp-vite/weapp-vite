import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const temporaryRoots: string[] = []
const setupFilename = 'vitest.globalSetup.mjs'
const markerFilename = 'fixture-cleanup-marker'
const configFiles = [
  'vitest.config.mts',
  'vitest.coverage.ts',
  'scripts/verification/toolTests.ts',
  'scripts/verification/topology.ts',
  'scripts/verificationBenchmark/localReporterConfig.mjs',
  'scripts/verificationTelemetry/vitest.mjs',
  'scripts/verificationTelemetry/reporter.mjs',
  'scripts/verificationTelemetry/coverage.mjs',
  'scripts/verificationTelemetry/logicalCoverage.mjs',
  'packages/weapp-vite/vitest.config.ts',
  'packages/weapp-vite/vitest.web.config.ts',
  'packages/weapp-vite/vitest/partition.ts',
]
const setupProbe = `import fs from 'node:fs/promises'
export default async function setup() {
  await fs.rm(new URL('./${markerFilename}', import.meta.url))
}
`

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function createCheckoutPair() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vitest-checkout-'))
  temporaryRoots.push(temporaryRoot)
  const parentRoot = await fs.realpath(temporaryRoot)
  const checkoutRoot = path.join(parentRoot, '.worktrees', 'checkout')

  for (const root of [parentRoot, checkoutRoot]) {
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}\n')
    await fs.writeFile(path.join(root, setupFilename), setupProbe)
    await fs.writeFile(path.join(root, markerFilename), 'preserve another checkout\n')
    await fs.symlink(path.join(repositoryRoot, 'node_modules'), path.join(root, 'node_modules'), 'junction')
  }

  for (const file of configFiles) {
    const destination = path.join(checkoutRoot, file)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(path.join(repositoryRoot, file), destination)
  }
  await fs.writeFile(path.join(checkoutRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  return { parentRoot, checkoutRoot }
}

describe('Vitest checkout cleanup isolation', () => {
  it.each([
    { config: 'packages/weapp-vite/vitest.config.ts', launchRoot: 'checkout', mode: 'direct' },
    { config: 'packages/weapp-vite/vitest.web.config.ts', launchRoot: 'checkout', mode: 'direct' },
    { config: 'vitest.config.mts', launchRoot: 'checkout', mode: 'workspace' },
    { config: 'vitest.config.mts', launchRoot: 'parent', mode: 'workspace' },
  ])('keeps $mode setup in its checkout: $config from $launchRoot', async ({ config, launchRoot, mode }) => {
    const { parentRoot, checkoutRoot } = await createCheckoutPair()
    const context = await createVitest({
      config: path.join(checkoutRoot, config),
      root: launchRoot === 'parent' ? parentRoot : checkoutRoot,
      run: true,
      project: mode === 'workspace' ? ['repo-scripts'] : undefined,
      coverage: { enabled: false },
    })

    try {
      const setupPaths = [...new Set([
        ...context.config.globalSetup,
        ...context.projects.flatMap(project => project.config.globalSetup),
      ])]
      expect(setupPaths.map(file => path.normalize(file)))
        .toEqual(mode === 'workspace' ? [] : [path.join(checkoutRoot, setupFilename)])
      expect(context.projects.length).toBeGreaterThan(0)

      // 用临时探针执行解析后的入口，避免调用真实仓库的 fixture 清理。
      for (const file of setupPaths) {
        const setup = await import(pathToFileURL(file).href) as { default: () => Promise<void> }
        await setup.default()
      }

      if (mode === 'workspace') {
        expect(await fs.readFile(path.join(checkoutRoot, markerFilename), 'utf8')).toBe('preserve another checkout\n')
      }
      else {
        await expect(fs.access(path.join(checkoutRoot, markerFilename))).rejects.toMatchObject({ code: 'ENOENT' })
      }
      expect(await fs.readFile(path.join(parentRoot, markerFilename), 'utf8'))
        .toBe('preserve another checkout\n')
    }
    finally {
      await context.close()
    }
  })
})
