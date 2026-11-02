import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { expect, it } from 'vitest'
import { parseCLI } from 'vitest/node'

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8')

it('runs public product entries from the required gate and preserves explicit diagnostics', async () => {
  const manifest = JSON.parse(await read('../../package.json')) as { scripts: Record<string, string> }
  const gate = manifest.scripts['test:dependency-contracts']!
  expect(gate).toContain('scripts/dependencyContracts/vite/product/required.mjs')
  expect(gate).toContain('scripts/dependencyContracts/rolldown/product/run.mjs')
  expect(gate).toContain('scripts/dependencyContracts/chokidar/run.mjs')
  expect(gate).not.toContain('--expose-gc')
  expect(gate).not.toContain('scripts/dependencyContracts/vite/run.mjs')
  expect(gate).not.toContain('scripts/dependencyContracts/rolldown/run.mjs')
  const diagnostics = manifest.scripts['diagnose:dependency-internals']!
  expect(diagnostics).toContain('--expose-gc')
  expect(diagnostics).toContain('scripts/dependencyContracts/vite/diagnostics.mjs')
  expect(diagnostics).toContain('scripts/dependencyContracts/rolldown/run.mjs')
  const fullProduct = manifest.scripts['diagnose:vite-product-lifecycle']!
  expect(fullProduct).toContain('scripts/dependencyContracts/vite/product/run.mjs')
  for (const command of [gate, diagnostics, fullProduct]) {
    expect(command).not.toMatch(/--(?:skip|allow-failures|continue-on-error)|\|\|\s*true/)
  }
})

it('keeps the public Vite entry independent from source extraction and the diagnostic inventory', async () => {
  const source = await read('./vite/product/run.mjs')
  expect(source).toContain('import(\'../../../../packages/weapp-vite/scripts/viteProductContracts/index.ts\')')
  expect(source).toContain('verifyViteProductContracts((result) =>')
  expect(source).toContain('recordProductResult(report, result)')
  expect(source).toContain('require.resolve(\'vite/package.json\')')
  expect(source).not.toMatch(/readInstalledVite|evaluateStrict|extract\(|\/hooks\/|optimizerCancel|--expose-gc/)
  const wrapper = await read('./vite.test.ts')
  expect(wrapper).toContain('./vite/product/required.mjs')
  expect(wrapper).toContain('accepted-with-waivers')
  expect(wrapper).not.toContain('./vite/run.mjs')
  const required = await read('./vite/product/required.mjs')
  expect(required).toContain('applyViteAcceptancePolicy(report, { vite: vite.version, rolldown: rolldown.version })')
  expect(required).toContain('createRequire(new URL(\'../../../../packages/weapp-vite/scripts/viteProductContracts/index.ts\', import.meta.url))')
  expect(required).toContain('verifyViteProductAcceptance((result) =>')
  expect(required).toContain('withViteProductOwnership')
  expect(required).toContain('completeProductReport(report, viteRequiredContractNames)')
  expect(required).toContain('process.exitCode = 1')
})

it('keeps public lifecycle and watcher regressions discoverable from the HMR entry', async () => {
  const manifest = JSON.parse(await read('../../package.json')) as { scripts: Record<string, string> }
  const { filter, options } = parseCLI(manifest.scripts['test:hmr']!)
  const root = path.resolve(import.meta.dirname, '../..')
  const expected = [
    'scripts/dependencyContracts/vite.test.ts',
    ...await glob('packages/weapp-vite/src/devLifecycle/**/*.test.ts', { cwd: root }),
    ...await glob('packages/weapp-vite/src/runtime/watch/viteRegistration/**/*.test.ts', { cwd: root }),
  ]
  const discovered = new Set(await glob(expected, {
    cwd: root,
    ignore: options.exclude,
  }))
  for (const file of expected) {
    expect(discovered.has(file), file).toBe(true)
    expect(filter.some(entry => file === entry || file.startsWith(`${entry}/`)), file).toBe(true)
  }
})

it('keeps the old watcher assertions available only through explicit diagnostic configuration', async () => {
  const source = await read('./vite/diagnostics.mjs')
  expect(source).toContain('./run.mjs')
  expect(source).toContain('./diagnostics.config.mjs')
  expect(source).not.toMatch(/reject\s*:\s*false|catch\s*\(/)
  const configuration = await read('./vite/diagnostics.config.mjs')
  expect(configuration).toContain('scripts/dependencyContracts/vite/*.diagnostic.ts')
  expect(configuration).toContain('fileParallelism: false')
  for (const file of ['./vite/missingEnvReady.diagnostic.ts', './vite/pollingBackend.diagnostic.ts']) {
    expect(await read(file)).not.toMatch(/\.skip\(|\.todo\(|\.fails\(/)
  }
})

it('keeps public Rolldown execution independent of diagnostic cases and private binding layouts', async () => {
  const source = await read('./rolldown/product/run.mjs')
  expect(source).toContain('createProductContracts({ rolldown, watch, scan }, fixtureRoot)')
  expect(source).toContain('completeProductReport(report, productContractNames)')
  expect(source).not.toMatch(/bindingify|optionsBinding|--expose-gc|globalThis\.gc|\.\/retention\.mjs|\.\/hooks\.mjs/)
  const diagnostic = await read('./rolldown/run.mjs')
  expect(diagnostic).toContain('suite: \'dependency-internals\'')
  expect(diagnostic).toContain('import { retention } from \'./retention.mjs\'')
  expect(diagnostic).toContain('completeContractReport(report)')
})
