import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(extensionRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

it('package.json files whitelist is the only publish filter', () => {
  assert.equal(fs.existsSync(path.join(extensionRoot, '.vscodeignore')), false)
  assert.deepEqual([...packageJson.files].sort(), [
    'assets/**',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist/**',
    'package.json',
    'snippets/**',
    'syntaxes/**',
  ].sort())
})

it('package output keeps runtime entry files on disk', () => {
  const requiredFiles = [
    'extension.ts',
    'extension/index.ts',
    'extension/shared/constants.ts',
    'extension/shared/config.ts',
    'extension/editor/content.ts',
    'extension/editor/providers.ts',
    'extension/project/navigation.ts',
    'extension/project/workspace.ts',
    'extension/template/templateProviders.ts',
    'extension/ui/commands.ts',
    'tsconfig.json',
    'vitest.config.ts',
    'snippets/weapp-vite.code-snippets',
    'scripts/check-package.ts',
    'scripts/check-vsix.ts',
    'scripts/package-dry-run.ts',
    'scripts/plan-marketplace-release.ts',
    'scripts/release-vsce.ts',
    'scripts/launch-vsix-vscode.ts',
    'scripts/smoke-test.ts',
    'scripts/vscode-e2e-shared.ts',
    'scripts/vscode-host-smoke.ts',
    'scripts/vscode-host-smoke-runner.cjs',
    'scripts/vsix-e2e.ts',
    'scripts/vsix-e2e-runner.cjs',
    'assets/logo.svg',
    'assets/wxml.svg',
    'assets/weapp-vite-icon-theme.json',
    'scripts/fixtures/vscode-host-smoke/package.json',
    'scripts/fixtures/vscode-host-smoke/vite.config.ts',
    'scripts/fixtures/vscode-host-smoke/weapp-vite.config.ts',
    'scripts/fixtures/vscode-host-smoke/src/app.json',
    'scripts/fixtures/vscode-host-smoke/src/pages/home/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/pages/legacy/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/pages/unregistered/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/packageA/profile/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/components/shared/card/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/components/shared/filter-bar/index.vue',
    'scripts/fixtures/vscode-host-smoke/src/components/raw-banner/index.wxml',
    'scripts/fixtures/vscode-vsix-test-harness/package.json',
    'scripts/fixtures/vscode-vsix-test-harness/extension.js',
    'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
  ]

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(extensionRoot, relativePath)), true, relativePath)
  }
})
