import os from 'node:os'
import fs from 'fs-extra'
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

    const { tsconfigNode } = await initTsJsonFiles({ root, write: false })

    expect(tsconfigNode.include).toContain('vite.config.custom.ts')
    expect(ctx.tsconfig.name).toBe('tsconfig.json')
    expect(ctx.tsconfigApp.name).toBe('tsconfig.app.json')
    expect(ctx.tsconfigNode.name).toBe('tsconfig.node.json')
  })

  it('writes tsconfig files to disk by default', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-config-ts-write-'))
    await initTsJsonFiles({ root })

    expect(await fs.pathExists(path.join(root, 'tsconfig.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'tsconfig.app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'tsconfig.node.json'))).toBe(true)
  })
})
