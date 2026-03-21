import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import ts from 'typescript'
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

    expect(shared.compilerOptions.target).toBe(ts.ScriptTarget.ES2023)
    expect(app.extends).toBe('./tsconfig.shared.json')
    expect(app.compilerOptions.baseUrl).toBe('..')
    expect(app.compilerOptions.types).toContain('miniprogram-api-typings')
    expect(app.include).toContain('../src/**/*')
    expect(node.extends).toBe('./tsconfig.shared.json')
    expect(node.compilerOptions.types).toContain('node')
    expect(node.include).toContain('../vite.config.ts')
    expect(server.extends).toBe('./tsconfig.shared.json')
    expect(server.compilerOptions.types).toContain('node')
    expect(server.files).toEqual([])
  })

  it('adds wevu and web-aware settings and merges user overrides', async () => {
    const files = await createManagedTsconfigFiles(createCtx({
      packageJson: {
        dependencies: {
          wevu: '^1.0.0',
        },
      },
      weappViteConfig: {
        web: {
          enabled: true,
        },
        typescript: {
          app: {
            compilerOptions: {
              paths: {
                '@weapp-vite/web': ['../../packages/web/src/index.ts'],
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

    expect(app.compilerOptions.types).toEqual(expect.arrayContaining(['miniprogram-api-typings', 'vite/client']))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['.weapp-vite/typed-components.d.ts'])
    expect(app.compilerOptions.paths['@weapp-vite/web']).toEqual(['../../packages/web/src/index.ts'])
    expect(app.vueCompilerOptions.lib).toBe('wevu')
    expect(app.vueCompilerOptions.target).toBe(3.5)
    expect(app.include).toContain('../playground/**/*.ts')
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
    expect(app.compilerOptions.paths['tdesign-miniprogram/*']).toEqual(['./node_modules/tdesign-miniprogram/miniprogram_dist/*'])
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
    expect(app.compilerOptions.paths['@/*']).toEqual(['src/*'])
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

    await syncManagedTsconfigBootstrapFiles(root)

    const app = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.app.json'))
    const server = await fs.readJson(path.join(root, '.weapp-vite', 'tsconfig.server.json'))
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['.weapp-vite/typed-components.d.ts'])
    expect(server.files).toEqual([])
  })
})
