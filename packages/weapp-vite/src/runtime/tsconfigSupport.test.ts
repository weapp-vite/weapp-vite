import os from 'node:os'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createManagedTsconfigFiles, syncManagedTsconfigBootstrapFiles, syncManagedTsconfigFiles } from './tsconfigSupport'

function createCtx(overrides: Record<string, any> = {}) {
  return {
    configService: {
      cwd: '/project',
      configFilePath: '/project/vite.config.ts',
      packageJson: {},
      weappViteConfig: {},
      ...overrides,
    },
  } as any
}

describe('tsconfig support', () => {
  it('creates managed tsconfig files with standard defaults', async () => {
    const files = await createManagedTsconfigFiles(createCtx())
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)
    const node = JSON.parse(files.find(file => file.path.endsWith('tsconfig.node.json'))!.content)
    const server = JSON.parse(files.find(file => file.path.endsWith('tsconfig.server.json'))!.content)
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)

    expect(shared.compilerOptions.target).toBe('ES2023')
    expect(app.extends).toBe('./tsconfig.shared.json')
    expect(app.compilerOptions.lib).toEqual(['ES2023', 'DOM'])
    expect(app.compilerOptions.types).toContain('miniprogram-api-typings')
    expect(app.compilerOptions.types).toContain('weapp-vite/client')
    expect(app.compilerOptions.types).not.toContain('vite/client')
    expect(app.include).toContain('../src/**/*')
    expect(app.compilerOptions.paths['@/*']).toEqual(['../src/*'])
    expect(node.extends).toBe('./tsconfig.shared.json')
    expect(node.compilerOptions.types).toContain('node')
    expect(node.include).toContain('../vite.config.ts')
    expect(node.include).toContain('../weapp-vite.config.ts')
    expect(server.extends).toBe('./tsconfig.shared.json')
    expect(server.compilerOptions.types).toContain('node')
    expect(server.files).toEqual([])
  })

  it('adds wevu and web-aware settings and merges user overrides', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      cwd: '/repo/apps/demo',
      configFilePath: '/repo/apps/demo/vite.config.ts',
      packageJson: {
        dependencies: {
          wevu: '^1.0.0',
        },
      },
      weappViteConfig: {
        web: {
          enable: true,
        },
        typescript: {
          app: {
            compilerOptions: {
              paths: {
                '@weapp-vite/web': ['../../packages-runtime/web/src/index.ts'],
              },
            },
            include: ['../playground/**/*.ts'],
            vueCompilerOptions: {
              target: 3.5,
            },
          },
        },
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client', 'vite/client']))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['./typed-components.d.ts'])
    expect(app.compilerOptions.paths['@weapp-vite/web']).toEqual(['../../../packages-runtime/web/src/index.ts'])
    expect(app.vueCompilerOptions.lib).toBe('wevu')
    expect(app.vueCompilerOptions.target).toBe(3.5)
    expect(app.include).toContain('../playground/**/*.ts')
  })

  it('prefers platform-specific typings for tt projects when the package is installed', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      packageJson: {
        devDependencies: {
          '@douyin-microapp/typings': '^1.3.1',
        },
      },
      weappViteConfig: {
        platform: 'tt',
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['@douyin-microapp/typings', 'weapp-vite/client']))
    expect(app.compilerOptions.types).not.toContain('miniprogram-api-typings')
  })

  it('merges legacy root tsconfig files into managed outputs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-legacy-tsconfig-'))
    await fs.writeFile(path.join(root, 'tsconfig.shared.json'), `{
      // legacy shared config
      "compilerOptions": {
        "strict": false
      }
    }`)
    await fs.writeFile(path.join(root, 'tsconfig.app.json'), `{
      "compilerOptions": {
        "paths": {
          "tdesign-miniprogram/*": ["./node_modules/tdesign-miniprogram/miniprogram_dist/*"]
        }
      },
      "include": ["../legacy/**/*.ts"],
      "exclude": ["../legacy-exclude/**"]
    }`)
    await fs.writeFile(path.join(root, 'tsconfig.server.json'), `{
      "files": ["../server/entry.ts"]
    }`)

    const files = await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)
    const server = JSON.parse(files.find(file => file.path.endsWith('tsconfig.server.json'))!.content)
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)

    expect(shared.compilerOptions.strict).toBe(false)
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
    expect(app.compilerOptions.paths['tdesign-miniprogram/*']).toEqual(['../node_modules/tdesign-miniprogram/miniprogram_dist/*'])
    expect(app.include).toContain('../legacy/**/*.ts')
    expect(app.exclude).toContain('../legacy-exclude/**')
    expect(server.files).toContain('../server/entry.ts')
  })

  it('ignores invalid legacy root tsconfig files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-invalid-legacy-tsconfig-'))
    await fs.writeFile(path.join(root, 'tsconfig.app.json'), '{ invalid jsonc')

    const files = await createManagedTsconfigFiles(createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.include).toContain('../src/**/*')
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
    expect(app.compilerOptions.paths['@/*']).toEqual(['../src/*'])
  })

  it('points default @ alias to configured srcRoot', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      srcRoot: 'miniprogram',
      weappViteConfig: {},
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.paths['@/*']).toEqual(['../miniprogram/*'])
  })

  it('keeps builtin app macro types when user overrides app compilerOptions.types', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      weappViteConfig: {
        web: {
          enable: true,
        },
        typescript: {
          app: {
            compilerOptions: {
              types: ['custom-env'],
            },
          },
        },
      },
    }))
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client', 'vite/client', 'custom-env']))
  })

  it('writes managed tsconfig files into .weapp-vite', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-managed-tsconfig-'))
    const ctx = createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      weappViteConfig: {},
    })

    await syncManagedTsconfigFiles(ctx)

    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.shared.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.node.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite', 'tsconfig.server.json'))).toBe(true)
  })

  it('bootstraps managed tsconfig files from cwd and package.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-'))
    await fs.writeJson(path.join(root, 'package.json'), {
      devDependencies: {
        wevu: '^1.0.0',
      },
    })

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(true)

    const app = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.app.json'))
    const server = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.server.json'))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['./typed-components.d.ts'])
    expect(server.files).toEqual([])
  })

  it('returns false when bootstrap managed tsconfig files are already fresh', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-fresh-'))
    await fs.writeJson(path.join(root, 'package.json'), {})

    await syncManagedTsconfigBootstrapFiles(root)

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(false)
  })

  it('bootstraps managed tsconfig files without package.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-no-package-json-'))

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(true)

    const app = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.app.json'))
    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'weapp-vite/client']))
  })

  it('does not overwrite richer managed tsconfig files during bootstrap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-bootstrap-tsconfig-preserve-'))
    await fs.writeJson(path.join(root, 'package.json'), {
      devDependencies: {
        wevu: '^1.0.0',
      },
    })

    const ctx = createCtx({
      cwd: root,
      configFilePath: path.join(root, 'vite.config.ts'),
      packageJson: {
        devDependencies: {
          wevu: '^1.0.0',
        },
      },
      weappViteConfig: {
        typescript: {
          app: {
            compilerOptions: {
              paths: {
                'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
              },
            },
          },
        },
      },
    })

    await syncManagedTsconfigFiles(ctx)
    const before = await fs.readFile(path.join(root, '.weapp-vite', 'tsconfig.app.json'), 'utf8')

    await expect(syncManagedTsconfigBootstrapFiles(root)).resolves.toBe(false)

    const after = await fs.readFile(path.join(root, '.weapp-vite', 'tsconfig.app.json'), 'utf8')
    const app = JSON.parse(after)

    expect(after).toBe(before)
    expect(app.compilerOptions.paths['tdesign-miniprogram/*']).toEqual(['../node_modules/tdesign-miniprogram/miniprogram_dist/*'])
  })
})
