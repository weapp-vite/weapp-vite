const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

test('manifest exposes practical command set', () => {
  const commandIds = packageJson.contributes.commands.map(command => command.command)

  assert.deepEqual(commandIds, [
    'weapp-vite.generate',
    'weapp-vite.dev',
    'weapp-vite.build',
    'weapp-vite.open',
    'weapp-vite.doctor',
    'weapp-vite.showProjectInfo',
    'weapp-vite.showOutput',
    'weapp-vite.runAction',
    'weapp-vite.insertJsonBlockTemplate',
    'weapp-vite.insertDefineConfigTemplate',
    'weapp-vite.insertCommonScripts',
    'weapp-vite.openDocs',
  ])
})

test('manifest keeps publish-safe file whitelist', () => {
  assert.deepEqual(packageJson.files, [
    'assets/**',
    'extension.js',
    'extension/**',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'package.json',
    'scripts/**',
    'snippets/**',
    'syntaxes/**',
  ])
})

test('manifest exposes local verification scripts', () => {
  assert.equal(packageJson.scripts.lint, 'pnpm eslint extension.js extension/*.js')
  assert.equal(packageJson.scripts.test, 'node --test extension/*.test.js')
  assert.equal(packageJson.scripts.check, 'pnpm run lint && pnpm run test')
  assert.equal(packageJson.scripts['check:package'], 'node scripts/check-package.mjs')
  assert.equal(packageJson.scripts['check:publish'], 'pnpm run check && pnpm run check:package')
  assert.equal(packageJson.scripts['package:dry-run'], 'node scripts/package-dry-run.mjs package')
  assert.equal(packageJson.scripts['publish:vsce'], 'node scripts/release-vsce.mjs publish')
})

test('manifest config defaults stay enabled for core ergonomics', () => {
  const properties = packageJson.contributes.configuration.properties

  assert.equal(properties['weapp-vite.showStatusBar'].default, true)
  assert.equal(properties['weapp-vite.enablePackageJsonDiagnostics'].default, true)
  assert.equal(properties['weapp-vite.enableHover'].default, true)
  assert.equal(properties['weapp-vite.enableCompletion'].default, true)
  assert.equal(properties['weapp-vite.preferWvAlias'].default, true)
})
