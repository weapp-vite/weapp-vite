import os from 'node:os'
import fs from 'fs-extra'
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
  it('creates managed tsconfig files with standard defaults', () => {
    const files = createManagedTsconfigFiles(createCtx())
    const app = JSON.parse(files.find(file => file.path.endsWith('tsconfig.app.json'))!.content)
    const node = JSON.parse(files.find(file => file.path.endsWith('tsconfig.node.json'))!.content)
    const shared = JSON.parse(files.find(file => file.path.endsWith('tsconfig.shared.json'))!.content)

    expect(shared.compilerOptions.target).toBe('ES2023')
    expect(app.extends).toBe('./tsconfig.shared.json')
    expect(app.compilerOptions.baseUrl).toBe('..')
    expect(app.compilerOptions.types).toContain('miniprogram-api-typings')
    expect(app.include).toContain('../src/**/*')
    expect(node.extends).toBe('./tsconfig.shared.json')
    expect(node.compilerOptions.types).toContain('node')
    expect(node.include).toContain('../vite.config.ts')
  })

  it('adds wevu and web-aware settings and merges user overrides', () => {
    const files = createManagedTsconfigFiles(createCtx({
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
    expect(app.compilerOptions.paths['weapp-vite/typed-components']).toEqual(['.weapp-vite/typed-components.d.ts'])
  })
})
