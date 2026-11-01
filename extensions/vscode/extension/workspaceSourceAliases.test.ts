import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'
import ts from 'typescript'
import { resolveConfig } from 'vite'
import { it } from 'vitest'
import bundleConfig from '../tsdown.config.mts'
import unitConfig from '../vitest.config'

const extensionRoot = path.resolve(import.meta.dirname, '..')
const platformSource = path.resolve(extensionRoot, '../../@weapp-core/shared/src/platforms/index.ts').replaceAll('\\', '/')

it('resolves platform types from source with the formal TypeScript config', () => {
  const config = ts.readConfigFile(path.join(extensionRoot, 'tsconfig.json'), ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, extensionRoot)
  const importer = path.resolve(extensionRoot, '../../packages/language-service/src/profiles/data.ts')
  const resolved = ts.resolveModuleName('@weapp-core/shared/platforms', importer, parsed.options, ts.sys).resolvedModule
  assert.equal(resolved?.resolvedFileName.replaceAll('\\', '/'), platformSource)
})

it('resolves the unit source closure with exact package subpaths', async () => {
  const config = await resolveConfig({ ...unitConfig, configFile: false, root: extensionRoot, logLevel: 'silent' }, 'serve')
  const resolve = config.createResolver()
  const importer = path.join(extensionRoot, 'extension/template/templateLanguages.ts')
  for (const [specifier, source] of Object.entries({
    '@weapp-core/shared/platforms': '../../@weapp-core/shared/src/platforms/index.ts',
    '@weapp-vite/language-service': '../../packages/language-service/src/index.ts',
    '@weapp-vite/ast': 'extension/languages/ast.ts',
    '@weapp-vite/ast/babel': 'extension/languages/ast.ts',
    '@weapp-vite/ast/babelTypes': '../../packages/ast/src/babelTypes.ts',
  })) {
    const resolved = await resolve(specifier, importer, true)
    assert.ok(resolved)
    assert.equal(resolved, path.resolve(extensionRoot, source).replaceAll('\\', '/'))
    assert.equal(fs.existsSync(resolved), true)
  }
  assert.equal(await resolve('@weapp-core/shared/platforms/runtime', importer, true), undefined)
  assert.equal(await resolve('@weapp-core/shared/platforms-extra', importer, true), undefined)
})

it('bundles the same platform source with the formal tsdown resolver options', async () => {
  const modules = new Set<string>()
  const virtualEntry = '\0workspace-platform-contract'
  const bundle = await rolldown({
    input: virtualEntry,
    resolve: { alias: bundleConfig.alias },
    plugins: [{
      name: 'contract:platform-source-closure',
      resolveId: id => id === virtualEntry ? id : null,
      load: id => id === virtualEntry ? 'export { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from "@weapp-core/shared/platforms"' : null,
      moduleParsed(module) {
        modules.add(module.id.replaceAll('\\', '/'))
      },
    }],
  })
  try {
    await bundle.generate({ format: 'esm' })
    assert.equal(modules.has(platformSource), true)
    assert.equal([...modules].some(id => id.includes('/@weapp-core/shared/dist/')), false)
  }
  finally {
    await bundle.close()
  }
})
