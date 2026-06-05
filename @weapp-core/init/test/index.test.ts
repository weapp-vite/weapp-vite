import os from 'node:os'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initConfig, resetContext } from '@/index'
import * as npm from '@/npm'
import { ctx } from '@/state'

interface PackageJsonShape {
  scripts?: Record<string, string>
}

describe('init', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetContext()
  })

  it('writes full config set when command is weapp-vite', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-init-config-'))
    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^0.0.0')

    await initConfig({ root, command: 'weapp-vite' })

    const files = [
      'package.json',
      'project.config.json',
      '.gitignore',
      'vite.config.ts',
      'tsconfig.json',
      'vite-env.d.ts',
    ]
    for (const file of files) {
      expect(await fs.pathExists(path.join(root, file))).toBe(true)
    }
    const pkg = await fs.readJSON(path.join(root, 'package.json')) as PackageJsonShape
    expect(pkg.scripts).toMatchObject({
      'dev': 'weapp-vite dev',
      'dev:open': 'weapp-vite dev -o',
      'build': 'weapp-vite build',
      'open': 'weapp-vite open',
      'g': 'weapp-vite generate',
    })
    expect(ctx.viteConfig.name).toBe('vite.config.ts')
    expect(ctx.packageJson.value?.scripts?.build).toBe('weapp-vite build')
  })

  it('infers root native miniprogram layout without mutating source outside root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-init-root-native-'))
    await fs.outputJSON(path.join(root, 'app.json'), { pages: ['pages/index/index'] })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^0.0.0')

    await initConfig({ root, command: 'weapp-vite' })

    const viteConfig = await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')
    expect(viteConfig).toContain(`srcRoot: '.'`)
    expect(ctx.projectLayout.srcRoot).toBe('.')
  })

  it('infers miniprogram native project layout from project config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-init-miniprogram-native-'))
    await fs.outputJSON(path.join(root, 'project.config.json'), {
      miniprogramRoot: 'miniprogram/',
      setting: {},
    })
    await fs.outputJSON(path.join(root, 'miniprogram/app.json'), { pages: ['pages/index/index'] })
    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^0.0.0')

    await initConfig({ root, command: 'weapp-vite' })

    const viteConfig = await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')
    expect(viteConfig).toContain(`srcRoot: 'miniprogram'`)
    expect(ctx.projectLayout.srcRoot).toBe('miniprogram')
    expect(ctx.tsconfigApp.value?.include).toContain('../miniprogram/**/*.ts')
  })

  it('skips optional files when command is not provided', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-init-lite-'))
    vi.spyOn(npm, 'latestVersion').mockResolvedValue('^0.0.0')

    await initConfig({ root })

    expect(await fs.pathExists(path.join(root, 'package.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'project.config.json'))).toBe(true)
    expect(await fs.pathExists(path.join(root, '.gitignore'))).toBe(true)
    expect(await fs.pathExists(path.join(root, 'vite.config.ts'))).toBe(false)
    expect(ctx.viteConfig.name).toBe('')
    expect(ctx.dts.value).toBeNull()
  })
})
