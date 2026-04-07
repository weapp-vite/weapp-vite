const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const extensionRoot = path.resolve(__dirname, '..')
const vscodeIgnorePath = path.join(extensionRoot, '.vscodeignore')

test('.vscodeignore excludes test-only and publishing-only files from package output', () => {
  const ignoreFile = fs.readFileSync(vscodeIgnorePath, 'utf8')
  const rules = ignoreFile
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  assert.ok(rules.includes('extension/*.test.js'))
  assert.ok(rules.includes('extension/**/*.test.js'))
  assert.ok(rules.includes('PUBLISHING.md'))
})

test('package output keeps runtime entry files on disk', () => {
  const requiredFiles = [
    'extension.js',
    'extension/index.js',
    'extension/constants.js',
    'extension/commands.js',
    'extension/content.js',
    'extension/providers.js',
    'extension/workspace.js',
    'snippets/weapp-vite.code-snippets',
    'scripts/check-package.mjs',
    'scripts/package-dry-run.mjs',
    'scripts/release-vsce.mjs',
    'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
  ]

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(extensionRoot, relativePath)), true, relativePath)
  }
})
