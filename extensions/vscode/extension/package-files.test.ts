import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'

const extensionRoot = path.resolve(__dirname, '..')
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
    'extension/constants.ts',
    'extension/commands.ts',
    'extension/content.ts',
    'extension/providers.ts',
    'extension/workspace.ts',
    'tsconfig.json',
    'vitest.config.ts',
    'types/vscode.d.ts',
    'snippets/weapp-vite.code-snippets',
    'scripts/check-package.ts',
    'scripts/check-vsix.ts',
    'scripts/package-dry-run.ts',
    'scripts/release-vsce.ts',
    'scripts/smoke-test.ts',
    'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
  ]

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(extensionRoot, relativePath)), true, relativePath)
  }
})
