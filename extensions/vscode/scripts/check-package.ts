import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const extensionRoot = path.resolve(process.cwd())
const packageJsonPath = path.join(extensionRoot, 'package.json')

/**
 * @param {string} filePath
 */
function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing file: ${path.relative(extensionRoot, filePath)}`)
  }
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

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
  'assets/logo.svg',
  'assets/weapp-vite-icon-theme.json',
  'scripts/vscode-host-smoke.ts',
  'scripts/vscode-host-smoke-runner.cjs',
  'scripts/vsix-e2e.ts',
  'scripts/vsix-e2e-runner.cjs',
  'snippets/weapp-vite.code-snippets',
  'scripts/fixtures/vscode-host-smoke/package.json',
  'scripts/fixtures/vscode-host-smoke/vite.config.ts',
  'scripts/fixtures/vscode-host-smoke/src/app.json',
  'scripts/fixtures/vscode-host-smoke/src/pages/home/index.vue',
  'scripts/fixtures/vscode-vsix-test-harness/package.json',
  'scripts/fixtures/vscode-vsix-test-harness/extension.js',
  'syntaxes/weapp-vite-custom-blocks.tmLanguage.json',
]

for (const relativePath of requiredFiles) {
  ensureFile(path.join(extensionRoot, relativePath))
}

if (fs.existsSync(path.join(extensionRoot, '.vscodeignore'))) {
  throw new Error('.vscodeignore should be removed when package.json files whitelist is present')
}

if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
  throw new Error('package.json files whitelist is empty')
}

if (packageJson.main !== './dist/extension.js') {
  throw new Error(`unexpected main entry: ${packageJson.main}`)
}

if (packageJson.scripts?.check !== 'pnpm run lint && pnpm run test && pnpm run build && pnpm run smoke:dist') {
  throw new Error('unexpected check script in package.json')
}

console.log('extensions/vscode package check ok')
