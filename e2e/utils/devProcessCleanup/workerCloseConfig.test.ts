import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it.each(['ci', 'ci.build-only', 'headless', 'devtools', 'internal', 'utils', 'hmr-guard', 'parallel', 'bun', 'web', ''])('keeps the native close gate and cleanup budget on the %s dev-controller entry', async (name) => {
  const filename = `vitest.e2e${name ? `.${name}` : ''}.config.ts`
  const source = await readFile(new URL(`../../${filename}`, import.meta.url), 'utf8')
  expect(source).toContain('vitest.e2e.dev-process.setup.ts')
  expect(source).toMatch(/hookTimeout:\s*DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS/u)
})

it('uses a separate zero-timeout final close gate instead of abandoning native work at the hook timer', async () => {
  const source = await readFile(new URL('../../vitest.e2e.dev-process.setup.ts', import.meta.url), 'utf8')
  expect(source).toContain('beginWindowsKernelQueryScope()')
  expect(source).toMatch(/afterAll\(\(\) => closeWindowsKernelQueryScope\(scope,[\s\S]*, 0\)/u)
})

it('keeps the root infrastructure project under the same native close gate and cleanup budget', async () => {
  const source = await readFile(new URL('../../../vitest.config.mts', import.meta.url), 'utf8')
  const infrastructure = source.slice(source.indexOf('name: \'e2e-hmr-infra\''), source.indexOf('...resolveProjects()'))
  expect(infrastructure).toContain('e2e/vitest.e2e.dev-process.setup.ts')
  expect(infrastructure).toMatch(/hookTimeout:\s*DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS/u)
  for (const file of [
    'e2e/utils/dev-process-cleanup-budget.test.ts',
    'e2e/utils/dev-process.preflight.test.ts',
    'e2e/utils/devProcessCleanup/windowsKernelArtifact.test.ts',
    'e2e/utils/devProcessCleanup/windowsKernelQuery.cancellation.test.ts',
    'e2e/utils/devProcessCleanup/workerCloseConfig.test.ts',
  ]) {
    expect(infrastructure).toContain(file)
  }
})

it.each(['vitest.config.mts', 'scripts/vitest.config.mjs'])('protects script-owned benchmark shutdown through %s', async (filename) => {
  const source = await readFile(new URL(`../../../${filename}`, import.meta.url), 'utf8')
  const scripts = filename === 'vitest.config.mts'
    ? source.slice(source.indexOf('name: \'repo-scripts\''), source.indexOf('name: \'e2e-hmr-infra\''))
    : source
  expect(scripts).toContain('e2e/vitest.e2e.dev-process.setup.ts')
  expect(scripts).toMatch(/hookTimeout:\s*DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS/u)
})
