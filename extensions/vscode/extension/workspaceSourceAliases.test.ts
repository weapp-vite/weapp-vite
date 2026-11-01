import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rolldown } from 'rolldown'
import ts from 'typescript'
import { resolveConfig, transformWithOxc } from 'vite'
import { it } from 'vitest'
import bundleConfig from '../tsdown.config.mts'
import unitConfig from '../vitest.config'

const extensionRoot = path.resolve(import.meta.dirname, '..')
const platformSource = path.resolve(extensionRoot, '../../@weapp-core/shared/src/platforms/index.ts').replaceAll('\\', '/')

it('transforms config modules with the extension config before unrelated apps have generated theirs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-extension-tsconfig-'))
  const source = 'export const answer: number = 42'
  const configModule = path.join(root, 'extension/tsdown.config.mts')
  try {
    const configs = {
      'tsconfig.json': { files: [], references: [{ path: './extension' }, { path: './apps/unprepared' }] },
      'extension/tsconfig.json': { compilerOptions: { target: 'ES2022', module: 'ESNext' }, include: ['extension/**/*.ts', 'scripts/**/*.ts'] },
      'apps/unprepared/tsconfig.json': { extends: './.weapp-vite/tsconfig.shared.json' },
    }
    for (const [relative, config] of Object.entries(configs)) {
      const file = path.join(root, relative)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(config))
    }
    await writeFile(configModule, source)
    await assert.rejects(transformWithOxc(source, configModule), /Failed to load tsconfig.*tsconfig\.shared\.json/su)

    const config = await resolveConfig({ ...unitConfig, configFile: false, root: extensionRoot, logLevel: 'silent' }, 'serve')
    assert.equal(config.tsconfig, path.join(extensionRoot, 'tsconfig.json').replaceAll('\\', '/'))
    const transformed = await transformWithOxc(source, configModule, {}, undefined, config)
    assert.match(transformed.code, /export const answer\s*=\s*42/u)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

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
