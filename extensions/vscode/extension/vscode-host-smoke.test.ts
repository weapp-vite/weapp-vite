import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { prepareHostSmokeExtension } from '../scripts/vscode-host-smoke'

it('stages the public extension identity and runtime assets without changing formatter settings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-host-identity-'))
  const extensionRoot = path.join(root, 'source')
  const userDataDir = path.join(root, 'user-data')
  const manifest = {
    'name': '@weapp-vite/vscode',
    'publisher': 'weapp-vite',
    'private': true,
    'main': './dist/extension.js',
    'files': ['package.json', 'dist/**', 'assets/**', 'syntaxes/**'],
    'scripts': { build: 'tsdown' },
    'devDependencies': { '@weapp-vite/oxfmt': 'workspace:*' },
    'x-vsce': { name: 'weapp-vite', displayName: 'Weapp Vite' },
  }
  const fixtureSettings = JSON.stringify({ '[wxml]': { 'editor.defaultFormatter': 'weapp-vite.weapp-vite' } })
  const inputs = {
    'package.json': JSON.stringify(manifest),
    'dist/extension.js': 'export function activate() {}\n',
    'assets/nested/icon.svg': '<svg/>\n',
    'syntaxes/wxml.json': '{}\n',
    'scripts/fixtures/workspace/.vscode/settings.json': fixtureSettings,
    '.vscode-test/downloaded-editor': 'not a publish asset',
    'node_modules/dependency/index.js': 'not a publish asset',
  }
  try {
    for (const [relative, content] of Object.entries(inputs)) {
      const file = path.join(extensionRoot, relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, content)
    }

    const { extensionId, extensionDevelopmentPath } = await prepareHostSmokeExtension(extensionRoot, userDataDir)
    assert.equal(extensionId, 'weapp-vite.weapp-vite')
    const staged = JSON.parse(await fs.readFile(path.join(extensionDevelopmentPath, 'package.json'), 'utf8')) as Record<string, unknown>
    assert.equal(staged.name, 'weapp-vite')
    assert.equal(staged.displayName, 'Weapp Vite')
    assert.equal('devDependencies' in staged, false)
    assert.equal('scripts' in staged, false)
    assert.equal('private' in staged, false)
    for (const relative of ['dist/extension.js', 'assets/nested/icon.svg', 'syntaxes/wxml.json'] as const) {
      assert.equal(await fs.readFile(path.join(extensionDevelopmentPath, relative), 'utf8'), inputs[relative])
    }
    for (const relative of ['scripts', '.vscode-test', 'node_modules']) {
      await assert.rejects(fs.access(path.join(extensionDevelopmentPath, relative)), { code: 'ENOENT' })
    }
    assert.equal(await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'), inputs['package.json'])
    assert.equal(await fs.readFile(path.join(extensionRoot, 'scripts/fixtures/workspace/.vscode/settings.json'), 'utf8'), fixtureSettings)
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
