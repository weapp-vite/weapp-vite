import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizePath } from '../../../utils/path'
import {
  inspectTsconfigPathsUsage,
  shouldEnableTsconfigPathsPlugin,
} from './tsconfigPaths'

describe('tsconfigPaths', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tsconfig-paths-')))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('returns disabled usage when no tsconfig files exist', async () => {
    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: false,
      root: false,
      references: false,
      aliases: [],
      referenceAliases: [],
    })
    await expect(shouldEnableTsconfigPathsPlugin(tempRoot)).resolves.toBe(false)
  })

  it('detects root paths usage and extracts aliases from tsconfig', async () => {
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
          '@shared': ['./shared/index.ts'],
          '@ignored*': ['./ignored/*'],
        },
      },
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: true,
      references: false,
      aliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
        { find: '@shared', replacement: normalizePath(path.join(tempRoot, 'shared/index.ts')) },
      ],
      referenceAliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
        { find: '@shared', replacement: normalizePath(path.join(tempRoot, 'shared/index.ts')) },
      ],
    })
  })

  it('resolves paths relative to config directory when baseUrl is omitted', async () => {
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          '@/*': ['src/*'],
        },
      },
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: true,
      references: false,
      aliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
      ],
      referenceAliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
      ],
    })
  })

  it('resolves paths relative to baseUrl when baseUrl is provided', async () => {
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: './src',
        paths: {
          '@/*': ['*'],
        },
      },
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: true,
      references: false,
      aliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
      ],
      referenceAliases: [
        { find: '@', replacement: normalizePath(path.join(tempRoot, 'src')) },
      ],
    })
  })

  it('collects aliases from extends chains', async () => {
    await fs.mkdir(path.join(tempRoot, 'configs'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'configs/base.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          '@base/*': ['./base-src/*'],
        },
      },
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      extends: './configs/base',
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: true,
      references: false,
      aliases: [
        { find: '@base', replacement: normalizePath(path.join(tempRoot, 'configs/base-src')) },
      ],
      referenceAliases: [
        { find: '@base', replacement: normalizePath(path.join(tempRoot, 'configs/base-src')) },
      ],
    })
  })

  it('resolves ordered extends arrays using the last complete paths mapping', async () => {
    await fs.mkdir(path.join(tempRoot, 'configs'))
    await fs.writeFile(path.join(tempRoot, 'configs/first.json'), JSON.stringify({ compilerOptions: { paths: { '@first/*': ['./first/*'], '@shared/*': ['./old/*'] } } }))
    await fs.writeFile(path.join(tempRoot, 'configs/last.json'), JSON.stringify({ compilerOptions: { paths: { '@shared/*': ['./last/*'] } } }))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({ extends: ['./configs/first.json', './configs/last.json'] }))
    expect((await inspectTsconfigPathsUsage(tempRoot)).aliases).toEqual([
      { find: '@shared', replacement: normalizePath(path.join(tempRoot, 'configs/last')) },
    ])
  })

  it('resolves package tsconfig inheritance without treating it as a runtime module', async () => {
    const configRoot = path.join(tempRoot, 'node_modules/@probe/tsconfig')
    await fs.mkdir(configRoot, { recursive: true })
    await fs.writeFile(path.join(configRoot, 'package.json'), JSON.stringify({ name: '@probe/tsconfig', version: '1.0.0', tsconfig: 'base.json' }))
    await fs.writeFile(path.join(configRoot, 'base.json'), JSON.stringify({ compilerOptions: { paths: { '@package/*': ['./source/*'] } } }))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({ extends: '@probe/tsconfig' }))
    expect((await inspectTsconfigPathsUsage(tempRoot)).aliases).toEqual([
      { find: '@package', replacement: normalizePath(path.join(configRoot, 'source')) },
    ])
  })

  it('replaces inherited paths as a complete mapping when a child defines paths', async () => {
    await fs.writeFile(path.join(tempRoot, 'base.json'), JSON.stringify({ compilerOptions: { paths: { '@obsolete/*': ['./old/*'] } } }))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({ extends: './base.json', compilerOptions: { paths: { '@current/*': ['./src/*'] } } }))
    expect((await inspectTsconfigPathsUsage(tempRoot)).aliases).toEqual([
      { find: '@current', replacement: normalizePath(path.join(tempRoot, 'src')) },
    ])
  })

  it('matches TypeScript 6 when a child baseUrl changes inherited paths resolution', async () => {
    await fs.mkdir(path.join(tempRoot, 'configs'))
    await fs.mkdir(path.join(tempRoot, 'source'))
    const target = path.join(tempRoot, 'source/value.ts')
    const importer = path.join(tempRoot, 'index.ts')
    const configFile = path.join(tempRoot, 'tsconfig.json')
    await fs.writeFile(target, 'export const value = 1')
    await fs.writeFile(importer, 'import { value } from "@shared/value"; void value')
    await fs.writeFile(path.join(tempRoot, 'configs/base.json'), JSON.stringify({ compilerOptions: { paths: { '@shared/*': ['./*'] }, baseUrl: './obsolete' } }))
    await fs.writeFile(configFile, JSON.stringify({ extends: './configs/base.json', compilerOptions: { baseUrl: './source', ignoreDeprecations: '6.0' } }))
    const config = ts.getParsedCommandLineOfConfigFile(configFile, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => expect.fail(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) })!
    const resolved = ts.resolveModuleName('@shared/value', importer, config.options, ts.sys).resolvedModule
    expect(resolved?.resolvedFileName).toBe(normalizePath(target))
    expect((await inspectTsconfigPathsUsage(tempRoot)).aliases).toEqual([
      { find: '@shared', replacement: normalizePath(path.dirname(target)) },
    ])
  })

  it('marks references usage when referenced tsconfig defines path aliases', async () => {
    await fs.mkdir(path.join(tempRoot, 'packages/pkg-a'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'packages/pkg-a/tsconfig.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          '@pkg-a/*': ['./src/*'],
        },
      },
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      references: [
        { path: './packages/pkg-a' },
      ],
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: false,
      references: true,
      aliases: [
        { find: '@pkg-a', replacement: normalizePath(path.join(tempRoot, 'packages/pkg-a/src')) },
      ],
      referenceAliases: [
        { find: '@pkg-a', replacement: normalizePath(path.join(tempRoot, 'packages/pkg-a/src')) },
      ],
    })
  })

  it('dedupes aliases from root, extends and references by find key', async () => {
    await fs.mkdir(path.join(tempRoot, 'shared'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'packages/pkg-a'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'shared/base.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          '@dup/*': ['./base-src/*'],
        },
      },
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'packages/pkg-a/tsconfig.json'), JSON.stringify({
      compilerOptions: {
        paths: {
          '@dup/*': ['./ref-src/*'],
          '@ref/*': ['./ref-only/*'],
        },
      },
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      extends: './shared/base.json',
      compilerOptions: {
        paths: {
          '@dup/*': ['./root-src/*'],
        },
      },
      references: [
        { path: './packages/pkg-a' },
      ],
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: true,
      references: true,
      aliases: [
        { find: '@dup', replacement: normalizePath(path.join(tempRoot, 'root-src')) },
        { find: '@ref', replacement: normalizePath(path.join(tempRoot, 'packages/pkg-a/ref-only')) },
      ],
      referenceAliases: [
        { find: '@dup', replacement: normalizePath(path.join(tempRoot, 'root-src')) },
        { find: '@ref', replacement: normalizePath(path.join(tempRoot, 'packages/pkg-a/ref-only')) },
      ],
    })
  })

  it.each([null, [], { compilerOptions: { paths: { '@bad/*': null } } }, { compilerOptions: { paths: { '@bad/*': [42] } } }])('ignores malformed config shapes without breaking prepare: %j', async (config) => {
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify(config))
    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toMatchObject({ aliases: [] })
  })

  it('handles invalid json, missing extends, and circular references safely', async () => {
    await fs.mkdir(path.join(tempRoot, 'a'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'b'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'a/tsconfig.json'), JSON.stringify({
      references: [{ path: '../b' }],
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'b/tsconfig.json'), JSON.stringify({
      references: [{ path: '../a' }],
      compilerOptions: {
        paths: {
          '@b/*': ['./src/*'],
        },
      },
    }, null, 2))
    await fs.writeFile(path.join(tempRoot, 'jsconfig.json'), '{invalid')
    await fs.writeFile(path.join(tempRoot, 'tsconfig.json'), JSON.stringify({
      extends: './missing-base',
      references: [{ path: './a' }],
    }, null, 2))

    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: true,
      root: false,
      references: true,
      aliases: [
        { find: '@b', replacement: normalizePath(path.join(tempRoot, 'b/src')) },
      ],
      referenceAliases: [
        { find: '@b', replacement: normalizePath(path.join(tempRoot, 'b/src')) },
      ],
    })
  })
})
