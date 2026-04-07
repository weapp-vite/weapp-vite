import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'

const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

it('manifest exposes practical command set', () => {
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

it('manifest keeps publish-safe file whitelist', () => {
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

it('manifest exposes local verification scripts', () => {
  assert.equal(packageJson.scripts.build, 'pnpm exec tsdown --config tsdown.config.mts')
  assert.equal(packageJson.scripts.lint, 'pnpm eslint extension.ts extension/**/*.ts scripts/**/*.ts tsdown.config.mts')
  assert.equal(packageJson.scripts.test, 'pnpm vitest run -c vitest.config.ts')
  assert.equal(packageJson.scripts.check, 'pnpm run lint && pnpm run test && pnpm run build')
  assert.equal(packageJson.scripts['check:package'], 'node --import tsx scripts/check-package.ts')
  assert.equal(packageJson.scripts['check:publish'], 'pnpm run check && pnpm run check:package')
  assert.equal(packageJson.scripts['package:dry-run'], 'pnpm run build && node --import tsx scripts/package-dry-run.ts package')
  assert.equal(packageJson.scripts['publish:vsce'], 'pnpm run check:publish && node --import tsx scripts/release-vsce.ts publish')
})

it('manifest config defaults stay enabled for core ergonomics', () => {
  const properties = packageJson.contributes.configuration.properties

  assert.equal(properties['weapp-vite.showStatusBar'].default, true)
  assert.equal(properties['weapp-vite.enablePackageJsonDiagnostics'].default, true)
  assert.equal(properties['weapp-vite.enableHover'].default, true)
  assert.equal(properties['weapp-vite.enableCompletion'].default, true)
  assert.equal(properties['weapp-vite.preferWvAlias'].default, true)
})
