import type { FixtureMode, FixtureResult } from './vueOxcResolvedConfig/fixtureWorker'
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

interface Fixture {
  run: (mode: FixtureMode) => Promise<FixtureResult>
}

const require = createRequire(import.meta.url)
const tsxLoader = pathToFileURL(require.resolve('tsx')).href
const workerFile = fileURLToPath(new URL('./vueOxcResolvedConfig/fixtureWorker.ts', import.meta.url))
const marker = 'resolved-child-tsconfig'

async function withFixture(run: (fixture: Fixture) => Promise<void>) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vue-oxc-resolved-config-')))
  const webRoot = path.join(root, 'web')
  const unpreparedRoot = path.join(root, 'unprepared')
  const componentFile = path.join(root, 'Fixture.vue')
  const configFile = path.join(webRoot, 'tsconfig.json')
  const missingConfigFile = path.join(unpreparedRoot, '.generated/tsconfig.shared.json')
  try {
    await Promise.all([mkdir(webRoot), mkdir(unpreparedRoot)])
    await Promise.all([
      writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
        files: [],
        references: [{ path: './unprepared' }, { path: './web' }],
      })),
      writeFile(path.join(unpreparedRoot, 'tsconfig.json'), JSON.stringify({
        extends: './.generated/tsconfig.shared.json',
        include: ['src'],
      })),
      writeFile(configFile, JSON.stringify({
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
        },
        include: ['../Fixture.vue'],
      })),
      writeFile(componentFile, `<script setup lang="ts">\nconst message: string = '${marker}'\n</script>\n<template><div>{{ message }}</div></template>\n`),
    ])
    await expect(access(missingConfigFile)).rejects.toMatchObject({ code: 'ENOENT' })
    await run({
      async run(mode) {
        // 每例单独进程从 solution root 发现配置，避免修改父进程 cwd 或复用 Vite 全局缓存。
        const { stdout } = await promisify(execFile)(process.execPath, ['--import', tsxLoader, workerFile, mode], {
          cwd: root,
          timeout: 20_000,
          windowsHide: true,
        })
        const result: unknown = JSON.parse(stdout)
        if (!result || typeof result !== 'object' || !('success' in result)) {
          throw new Error('Expected a structured Vue transform worker result')
        }
        if (result.success === false && 'error' in result && typeof result.error === 'string') {
          return { success: false, error: result.error }
        }
        if (result.success === true && 'code' in result && typeof result.code === 'string'
          && 'includePreserved' in result && typeof result.includePreserved === 'boolean') {
          const devServerRestored = 'devServerRestored' in result ? result.devServerRestored : undefined
          if (devServerRestored !== undefined && typeof devServerRestored !== 'boolean') {
            throw new Error('Unexpected Vue plugin restoration result')
          }
          return {
            success: true,
            code: result.code,
            devServerRestored,
            includePreserved: result.includePreserved,
          }
        }
        throw new Error('Unexpected Vue transform worker result shape')
      },
    })
    await expect(access(missingConfigFile)).rejects.toMatchObject({ code: 'ENOENT' })
  }
  finally {
    // execFile 已等待子进程退出；worker 先关闭自身 server，之后才允许删除 fixture。
    await rm(root, { recursive: true, force: true })
  }
}

describe('Vue Oxc resolved TypeScript configuration', () => {
  it('uses the explicit child tsconfig for a real Vue TS transform while an unrelated reference is unprepared', async () => {
    await withFixture(async ({ run }) => {
      const result = await run('serve-explicit')
      expect(result.success).toBe(true)
      if (!result.success) {
        throw new Error(result.error)
      }
      expect(result.code).toContain(marker)
      expect(result.code).not.toContain(': string')
    })
  }, 30_000)

  it('keeps the missing generated reference visible when no explicit tsconfig is provided', async () => {
    await withFixture(async ({ run }) => {
      const result = await run('serve-discovery')
      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error('Expected automatic discovery to reject the unprepared project reference')
      }
      expect(result.error).toContain('tsconfig.shared.json')
    })
  }, 30_000)

  it('keeps the existing guard effective for a real build and restores the Vue plugin options', async () => {
    await withFixture(async ({ run }) => {
      const result = await run('build-guard')
      expect(result.success).toBe(true)
      if (!result.success) {
        throw new Error(result.error)
      }
      expect(result.code).toContain(marker)
      expect(result.devServerRestored).toBe(true)
      expect(result.includePreserved).toBe(true)
    })
  }, 30_000)
})
