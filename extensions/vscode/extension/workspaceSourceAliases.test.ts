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
const wxmlCoreSource = path.resolve(extensionRoot, '../../packages/wxml/src/core.ts').replaceAll('\\', '/')
const wxmlPresetsSource = path.resolve(extensionRoot, '../../packages/wxml/src/presets/index.ts').replaceAll('\\', '/')

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

it('resolves platform and parser types from source with the formal TypeScript config', () => {
  const config = ts.readConfigFile(path.join(extensionRoot, 'tsconfig.json'), ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, extensionRoot)
  const importer = path.resolve(extensionRoot, '../../packages/language-service/src/profiles/data.ts')
  for (const [specifier, source] of Object.entries({
    '@weapp-core/shared/platforms': platformSource,
    '@weapp-vite/wxml/core': wxmlCoreSource,
    '@weapp-vite/wxml/presets': wxmlPresetsSource,
  })) {
    const resolved = ts.resolveModuleName(specifier, importer, parsed.options, ts.sys).resolvedModule
    assert.equal(resolved?.resolvedFileName.replaceAll('\\', '/'), source)
  }
})

it('resolves the unit source closure with exact package subpaths', async () => {
  const config = await resolveConfig({ ...unitConfig, configFile: false, root: extensionRoot, logLevel: 'silent' }, 'serve')
  const resolve = config.createResolver()
  const importer = path.join(extensionRoot, 'extension/template/templateLanguages.ts')
  for (const [specifier, source] of Object.entries({
    '@weapp-core/shared/platforms': '../../@weapp-core/shared/src/platforms/index.ts',
    '@weapp-vite/language-service': '../../packages/language-service/src/index.ts',
    '@weapp-vite/wxml/core': '../../packages/wxml/src/core.ts',
    '@weapp-vite/wxml/presets': '../../packages/wxml/src/presets/index.ts',
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
  assert.equal(await resolve('@weapp-vite/wxml/core-extra', importer, true), undefined)
  assert.equal(await resolve('@weapp-vite/wxml/presets/extra', importer, true), undefined)
})

it('bundles the language service and platform parser closure from source with the formal tsdown options', async () => {
  const modules = new Set<string>()
  const virtualEntry = '\0workspace-platform-contract'
  const bundle = await rolldown({
    ...bundleConfig.inputOptions({}),
    input: virtualEntry,
    resolve: { alias: bundleConfig.alias },
    plugins: [{
      name: 'contract:platform-source-closure',
      resolveId: id => id === virtualEntry ? id : null,
      load: id => id === virtualEntry
        ? 'export { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from "@weapp-core/shared/platforms"; export { analyzeTemplate } from "@weapp-vite/language-service"'
        : null,
      moduleParsed(module) {
        modules.add(module.id.replaceAll('\\', '/'))
      },
    }],
  })
  try {
    const { output } = await bundle.generate({ format: 'esm' })
    for (const source of [platformSource, wxmlCoreSource, wxmlPresetsSource]) {
      assert.equal(modules.has(source), true, `missing bundled source: ${path.relative(extensionRoot, source)}`)
    }
    assert.equal([...modules].some(id => id.includes('/@weapp-core/shared/dist/')), false)
    assert.equal([...modules].some(id => id.includes('/packages/wxml/dist/')), false)
    assert.equal(output.some(chunk => chunk.type === 'chunk' && chunk.imports.some(id => id.startsWith('@weapp-'))), false)
  }
  finally {
    await bundle.close()
  }
})

it('rejects unresolved imports instead of emitting an incomplete extension bundle', async () => {
  const virtualEntry = '\0workspace-unresolved-contract'
  const bundle = await rolldown({
    ...bundleConfig.inputOptions({}),
    input: virtualEntry,
    resolve: { alias: bundleConfig.alias },
    plugins: [{
      name: 'contract:unresolved-source',
      resolveId: id => id === virtualEntry ? id : null,
      load: id => id === virtualEntry ? 'export { missing } from "@weapp-vite/wxml/missing"' : null,
    }],
  })
  try {
    await assert.rejects(bundle.generate({ format: 'esm' }), /Could not resolve.*@weapp-vite\/wxml\/missing/su)
  }
  finally {
    await bundle.close()
  }
})
