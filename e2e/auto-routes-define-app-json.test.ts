import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/auto-routes-define-app-json')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const TYPED_ROUTER_PATH = path.join(APP_ROOT, 'typed-router.d.ts')

describe.sequential('e2e app: auto-routes defineAppJson', () => {
  it('builds with routes.pages, generates mutable tuple typings, and typechecks app config', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_ROUTER_PATH)

    await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      cwd: APP_ROOT,
      stdio: 'inherit',
    })

    expect(await fs.pathExists(TYPED_ROUTER_PATH)).toBe(true)
    const typedRouter = await fs.readFile(TYPED_ROUTER_PATH, 'utf8')

    expect(typedRouter).toContain('/* eslint-disable */')
    expect(typedRouter).toContain('// biome-ignore lint: disable')
    expect(typedRouter).toContain('// oxlint-disable')
    expect(typedRouter).toContain('// ------')
    expect(typedRouter).toContain('export type AutoRoutesPages = [')
    expect(typedRouter).toContain('    export type AutoRoutesPages = [')
    expect(typedRouter).toContain('"pages/home/index"')
    expect(typedRouter).toContain('"pages/logs/index"')
    expect(typedRouter).not.toContain('readonly [')

    await execa('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', 'tsconfig.json'], {
      cwd: APP_ROOT,
      stdio: 'inherit',
    })

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appJson = await fs.readJson(appJsonPath)
    expect(appJson.pages).toEqual([
      'pages/home/index',
      'pages/logs/index',
    ])
  })
})
