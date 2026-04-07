import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const extensionRoot = path.resolve(process.cwd())
const packageJsonPath = path.join(extensionRoot, 'package.json')
const vscodeIgnorePath = path.join(extensionRoot, '.vscodeignore')

/**
 * @param {string} filePath
 */
function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing file: ${path.relative(extensionRoot, filePath)}`)
  }
}

/**
 * @param {string[]} rules
 * @param {string} expectedRule
 */
function ensureRule(rules, expectedRule) {
  if (!rules.includes(expectedRule)) {
    throw new Error(`missing .vscodeignore rule: ${expectedRule}`)
  }
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const vscodeIgnoreRules = fs.readFileSync(vscodeIgnorePath, 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)

const requiredFiles = [
  'extension.ts',
  'extension/index.ts',
  'extension/constants.ts',
  'extension/commands.ts',
  'extension/content.ts',
  'extension/providers.ts',
  'extension/workspace.ts',
  'dist/extension.js',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'snippets/weapp-vite.code-snippets',
  'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
]

for (const relativePath of requiredFiles) {
  ensureFile(path.join(extensionRoot, relativePath))
}

for (const expectedRule of ['extension/*.test.ts', 'extension/**/*.test.ts', 'scripts/**', 'types/**', 'tsconfig.json', 'PUBLISHING.md']) {
  ensureRule(vscodeIgnoreRules, expectedRule)
}

if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
  throw new Error('package.json files whitelist is empty')
}

if (packageJson.main !== './dist/extension.js') {
  throw new Error(`unexpected main entry: ${packageJson.main}`)
}

if (packageJson.scripts?.check !== 'pnpm run lint && pnpm run test && pnpm run build') {
  throw new Error('unexpected check script in package.json')
}

console.log('extensions/vscode package check ok')
