import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const AdmZip = require('adm-zip')

const extensionRoot = process.cwd()
const vsixPath = path.join(extensionRoot, '.artifacts', 'weapp-vite.vsix')

if (!fs.existsSync(vsixPath)) {
  throw new Error(`missing vsix artifact: ${vsixPath}`)
}

const zip = new AdmZip(vsixPath)
const entries = zip.getEntries().map((entry: { entryName: string }) => entry.entryName).sort()
const packageJsonEntry = zip.getEntry('extension/package.json')

const requiredEntries = [
  'extension/LICENSE.txt',
  'extension/changelog.md',
  'extension/readme.md',
  'extension/assets/logo.png',
  'extension/assets/logo.svg',
  'extension/assets/weapp-vite-icon-theme.json',
  'extension/dist/extension.js',
  'extension/package.json',
  'extension/snippets/weapp-vite.code-snippets',
  'extension/syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
]

const forbiddenEntries = [
  'extension/extension.ts',
  'extension/extension/activation.test.ts',
  'extension/extension/index.ts',
  'extension/scripts/check-package.ts',
  'extension/scripts/check-vsix.ts',
  'extension/scripts/package-dry-run.ts',
  'extension/tsconfig.json',
  'extension/PUBLISHING.md',
]

for (const entry of requiredEntries) {
  assert.ok(entries.includes(entry), `missing vsix entry: ${entry}`)
}

for (const entry of forbiddenEntries) {
  assert.ok(!entries.includes(entry), `unexpected vsix entry: ${entry}`)
}

assert.ok(packageJsonEntry, 'missing packaged extension/package.json')

const packagedManifest = JSON.parse(zip.readAsText(packageJsonEntry))
assert.equal(packagedManifest.name, 'weapp-vite')
assert.equal(packagedManifest.displayName, 'Weapp Vite')
assert.equal('devDependencies' in packagedManifest, false)
assert.equal('scripts' in packagedManifest, false)
assert.equal('private' in packagedManifest, false)

console.log('extensions/vscode vsix check ok')
