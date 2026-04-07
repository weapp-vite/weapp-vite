import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'

const extensionRoot = path.resolve(__dirname, '..')
const vscodeIgnorePath = path.join(extensionRoot, '.vscodeignore')

it('.vscodeignore excludes test-only and publishing-only files from package output', () => {
  const ignoreFile = fs.readFileSync(vscodeIgnorePath, 'utf8')
  const rules = ignoreFile
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  assert.ok(rules.includes('extension/*.test.ts'))
  assert.ok(rules.includes('extension/**/*.test.ts'))
  assert.ok(rules.includes('scripts/**'))
  assert.ok(rules.includes('types/**'))
  assert.ok(rules.includes('tsconfig.json'))
  assert.ok(rules.includes('PUBLISHING.md'))
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
    'scripts/package-dry-run.ts',
    'scripts/release-vsce.ts',
    'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
  ]

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(extensionRoot, relativePath)), true, relativePath)
  }
})
