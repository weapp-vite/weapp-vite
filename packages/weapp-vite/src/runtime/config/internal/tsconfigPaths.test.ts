import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  inspectTsconfigPathsUsage,
  shouldEnableTsconfigPathsPlugin,
} from './tsconfigPaths'

describe('tsconfigPaths', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-tsconfig-paths-'))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('returns disabled usage when no tsconfig files exist', async () => {
    await expect(inspectTsconfigPathsUsage(tempRoot)).resolves.toEqual({
      enabled: false,
      root: false,
      references: false,
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
      referenceAliases: [
        { find: '@', replacement: path.join(tempRoot, 'src') },
        { find: '@shared', replacement: path.join(tempRoot, 'shared/index.ts') },
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
      referenceAliases: [
        { find: '@base', replacement: path.join(tempRoot, 'configs/base-src') },
      ],
    })
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
      referenceAliases: [
        { find: '@pkg-a', replacement: path.join(tempRoot, 'packages/pkg-a/src') },
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
      referenceAliases: [
        { find: '@dup', replacement: path.join(tempRoot, 'root-src') },
        { find: '@ref', replacement: path.join(tempRoot, 'packages/pkg-a/ref-only') },
      ],
    })
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
      referenceAliases: [
        { find: '@b', replacement: path.join(tempRoot, 'b/src') },
      ],
    })
  })
})
