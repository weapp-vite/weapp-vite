import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

it('routes public CI and full IDE acceptance to the complete stateful and fallback inventory', () => {
  for (const [command, suite] of Object.entries({
    'e2e:ci': 'ci',
    'e2e:ci:pr': 'ci-pr',
    'e2e:ci:non-hmr': 'ci-non-hmr',
    'e2e:ci:full': 'ci-full',
    'e2e:ide:headless:full': 'ide-headless-full',
    'e2e:ide:dom:headless': 'ide-dom-headless',
    'e2e:ide:full': 'ide-full',
    'e2e:ide:full:exhaustive': 'ide-full:exhaustive',
  })) {
    expect(scripts[command]?.split(/\s+/).at(-1)?.replaceAll('"', '')).toBe(suite)
    expect(scripts[command]).not.toContain(':classic')
    expect(scripts[command]).not.toMatch(/--allow-failures|--filter|--from/)
  }
})

it('keeps existing diagnostic aliases compatible without narrowing public acceptance', () => {
  for (const [command, suite] of Object.entries({
    'e2e:ci:diagnostic': 'ci',
    'e2e:hmr:build:diagnostic': 'hmr-build',
    'e2e:hmr:headless:diagnostic': 'ide-hmr-headless',
    'e2e:ide:hmr:diagnostic': 'ide-hmr',
    'e2e:ide:full:diagnostic': 'ide-full',
    'e2e:ide:full:exhaustive:diagnostic': 'ide-full:exhaustive',
  })) {
    expect(scripts[command]).toMatch(new RegExp(`(?:\\s|")${suite}(?:"|$)`))
    expect(scripts[command]).not.toContain(':classic')
  }
  for (const command of ['e2e:hmr:build', 'e2e:hmr:headless', 'e2e:ide:hmr', 'e2e:hmr:acceptance']) {
    expect(scripts[command]).not.toContain(':diagnostic')
  }
})

it('includes the host startup admission contract in the formal unit inventory', () => {
  expect(scripts['test:hmr']?.split(/\s+/)).toEqual(expect.arrayContaining([
    'packages/weapp-vite/src/runtime/hmrRuntimeHostCapabilities.test.ts',
    'packages/weapp-vite/src/cli/commands/serve/shutdown.integration.test.ts',
    'packages/weapp-vite/src/plugins/css/shared/sourceDependencies.test.ts',
    'packages/weapp-vite/src/plugins/css/shared/sourceDependencies.integration.test.ts',
    'scripts/dependencyContracts/chokidar/removeCooldown.test.ts',
    'scripts/dependencyContracts/chokidar/registration.test.ts',
    'scripts/workspace-hmr',
  ]))
})

it('routes the standalone CI HMR job through supported build acceptance and keeps legacy diagnostics', () => {
  expect(scripts['e2e:ci:hmr']).toBe('pnpm run e2e:hmr:build')
  expect(scripts['e2e:hmr:build']).toBe('node --import tsx ./e2e/scripts/run-hmr-acceptance.ts build')
  expect(scripts['e2e:ci:hmr:core']).toContain('pnpm run e2e:hmr:guard')
  expect(scripts['e2e:ci:hmr:all']).toContain('pnpm run e2e:ci:hmr:core')
})
