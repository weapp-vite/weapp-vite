import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initConfig, resetContext } from '@/index'
import * as npm from '@/npm'
import { ctx } from '@/state'

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
      'tsconfig.app.json',
      'tsconfig.node.json',
      'vite-env.d.ts',
    ]
    for (const file of files) {
      expect(await fs.pathExists(path.join(root, file))).toBe(true)
    }
    const pkg = await fs.readJSON(path.join(root, 'package.json'))
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
