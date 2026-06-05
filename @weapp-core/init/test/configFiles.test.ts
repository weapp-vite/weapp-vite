import os from 'node:os'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { initTsDtsFile, initTsJsonFiles, initViteConfigFile } from '@/configFiles'
import { ctx, resetContext } from '@/state'

describe('configFiles', () => {
  afterEach(() => {
    resetContext()
  })

  it('writes vite config for module packages to a custom destination', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-'))

    await initViteConfigFile({ root, dest: 'generated/vite.config.ts' })

    const outputPath = path.join(root, 'generated', 'vite.config.ts')
    expect(await fs.pathExists(outputPath)).toBe(true)
    expect(ctx.viteConfig.name).toBe('vite.config.ts')
    expect(ctx.viteConfig.value).toContain('defineConfig')
  })

  it('writes inferred srcRoot to vite config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-src-root-'))
    ctx.projectLayout.srcRoot = 'miniprogram'

    const code = await initViteConfigFile({ root, write: false })

    expect(code).toContain(`srcRoot: 'miniprogram'`)
  })

  it('uses .mts suffix for non-module packages without writing to disk', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-cjs-'))
    ctx.packageJson.value = { type: 'commonjs' } as any

    const code = await initViteConfigFile({ root, write: false })

    expect(code).toContain('defineConfig')
    expect(ctx.viteConfig.name).toBe('vite.config.mts')
    expect(await fs.pathExists(path.join(root, 'vite.config.mts'))).toBe(false)
  })

  it('writes vite-env.d.ts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-dts-'))
    await initTsDtsFile({ root })
    expect(await fs.pathExists(path.join(root, 'vite-env.d.ts'))).toBe(true)
  })

  it('skips writing dts file when write is false', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-dts-skip-'))
    await initTsDtsFile({ root, write: false })
    expect(await fs.pathExists(path.join(root, 'vite-env.d.ts'))).toBe(false)
  })

  it('initializes tsconfig files and includes generated vite config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-ts-'))
    ctx.viteConfig.name = 'vite.config.custom.ts'

    const { tsconfig, tsconfigApp } = await initTsJsonFiles({ root, write: false })

    expect(tsconfig.references?.map(ref => ref.path)).toContain('./.weapp-vite/tsconfig.server.json')
    expect(tsconfig.references?.map(ref => ref.path)).toContain('./.weapp-vite/tsconfig.node.json')
    expect(tsconfigApp.include).toContain('../src/**/*.ts')
    expect(ctx.tsconfig.name).toBe('tsconfig.json')
    expect(ctx.tsconfigApp.name).toBe('.weapp-vite/tsconfig.app.json')
    expect(ctx.tsconfigServer.name).toBe('.weapp-vite/tsconfig.server.json')
    expect(ctx.tsconfigNode.name).toBe('.weapp-vite/tsconfig.node.json')
  })

  it('initializes tsconfig app include from inferred srcRoot', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-ts-src-root-'))
    ctx.projectLayout.srcRoot = 'miniprogram'

    const { tsconfigApp } = await initTsJsonFiles({ root, write: false })

    expect(tsconfigApp.include).toContain('../miniprogram/**/*.ts')
    expect(ctx.tsconfigApp.value?.compilerOptions?.paths?.['@/*']).toEqual(['../miniprogram/*'])
  })

  it('writes tsconfig files to disk by default', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-ts-write-'))
    await initTsJsonFiles({ root })

    expect(await fs.pathExists(path.join(root, 'tsconfig.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite/tsconfig.app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite/tsconfig.node.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite/tsconfig.server.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite/tsconfig.shared.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.weapp-vite/tsconfig.shared.empty.d.ts'))).toBe(true)
  })
})
