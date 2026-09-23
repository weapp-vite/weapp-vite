import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用实际 pnpm 子进程验证构建审批，不依赖配置读取模拟。
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse, stringify } from 'yaml'
import { ensurePnpmBuildPolicy, findPnpmWorkspaceRoot } from '@/pnpmBuildPolicy'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'scaffold-build-policy-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('pnpm dependency build policy', () => {
  it('approves required template scripts and explicitly declines optional native builds', async () => {
    expect(await findPnpmWorkspaceRoot(root)).toBeUndefined()
    await ensurePnpmBuildPolicy(root)
    expect(await findPnpmWorkspaceRoot(root)).toBe(root)
    const policy = parse(await readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as Record<string, unknown>

    expect(policy.packages).toEqual([])
    expect(policy.allowBuilds).toEqual({
      '@swc/core': true,
      '@weapp-tailwindcss/merge': true,
      'oxc-resolver': true,
      'rolldown': true,
      '@parcel/watcher': false,
      'esbuild': false,
      'weapp-tailwindcss': false,
    })
    expect(policy).not.toHaveProperty('onlyBuiltDependencies')
    expect(policy).not.toHaveProperty('ignoredBuiltDependencies')
    expect(policy).not.toHaveProperty('ignoreScripts')
    expect(policy).not.toHaveProperty('dangerouslyAllowAllBuilds')
    expect(policy).not.toHaveProperty('strictDepBuilds')
  })

  it('runs approved dependency and project scripts while denying optional builds during an offline install', async () => {
    const project = path.join(root, 'project')
    await mkdir(project)
    for (const [archiveName, name] of [['approved', '@swc/core'], ['denied', 'esbuild']] as const) {
      const fixture = path.join(root, archiveName, 'package')
      await mkdir(fixture, { recursive: true })
      await writeFile(path.join(fixture, 'package.json'), JSON.stringify({
        name,
        version: '1.0.0',
        scripts: { postinstall: 'node postinstall.cjs' },
      }))
      await writeFile(path.join(fixture, 'postinstall.cjs'), 'require("node:fs").writeFileSync("built.txt", "ran")\n')
      const archivePath = path.join(root, `${archiveName}.tgz`)
      const fixtureRoot = path.dirname(fixture)
      // GNU tar on Windows treats a drive-letter path as a remote archive
      // (`C:`), so keep every tar argument relative to its working directory.
      await execa('tar', ['-czf', path.relative(fixtureRoot, archivePath).replaceAll(path.sep, '/'), 'package'], { cwd: fixtureRoot })
    }
    await writeFile(path.join(project, 'package.json'), JSON.stringify({
      name: 'build-policy-consumer',
      private: true,
      dependencies: { '@swc/core': 'file:../approved.tgz', 'esbuild': 'file:../denied.tgz' },
      scripts: { postinstall: 'node prepare.cjs' },
    }))
    await writeFile(path.join(project, 'prepare.cjs'), 'require("node:fs").writeFileSync("prepared.txt", "ran")\n')
    await ensurePnpmBuildPolicy(project)
    const configPath = path.join(project, 'pnpm-workspace.yaml')
    const policy = parse(await readFile(configPath, 'utf8')) as { allowBuilds: Record<string, boolean> }
    // pnpm 对本地 tarball 要求绑定来源的审批键；沿用生成策略的批准值，不扩大权限。
    policy.allowBuilds['@swc/core@file:../approved.tgz'] = policy.allowBuilds['@swc/core']!
    await writeFile(configPath, stringify(policy))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:npm_config_|pnpm_config_)/i.test(key)))

    const result = await execa('pnpm', [
      '--dir',
      project,
      'install',
      '--offline',
      '--reporter=append-only',
      '--store-dir',
      path.join(root, 'store'),
    ], {
      cwd: path.resolve(import.meta.dirname, '..'),
      extendEnv: false,
      env: { ...env, CI: 'true', COREPACK_ENABLE_NETWORK: '0', npm_config_userconfig: path.join(root, 'user.npmrc'), npm_config_globalconfig: path.join(root, 'global.npmrc') },
      timeout: 30_000,
    })

    expect(result.exitCode).toBe(0)
    expect(await readFile(path.join(project, 'node_modules/@swc/core/built.txt'), 'utf8')).toBe('ran')
    await expect(readFile(path.join(project, 'node_modules/esbuild/built.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(project, 'prepared.txt'), 'utf8')).toBe('ran')
  }, 45_000)

  it('preserves existing workspace packages, comments and team approval rules byte for byte', async () => {
    const configPath = path.join(root, 'pnpm-workspace.yaml')
    const existing = '# Team rules\r\npackages:\r\n  - apps/*\r\nallowBuilds:\r\n  esbuild: true\r\n'
    await writeFile(configPath, existing)

    await ensurePnpmBuildPolicy(root)

    expect(await readFile(configPath, 'utf8')).toBe(existing)
  })

  it('keeps an ancestor workspace in charge without creating a nested workspace boundary', async () => {
    const configPath = path.join(root, 'pnpm-workspace.yaml')
    const existing = 'packages:\n  - apps/*\nallowBuilds:\n  esbuild: true\n'
    const project = path.join(root, 'apps', 'new-project')
    await mkdir(project, { recursive: true })
    await writeFile(configPath, existing)

    await ensurePnpmBuildPolicy(project)

    expect(await findPnpmWorkspaceRoot(project)).toBe(root)
    await expect(readFile(path.join(project, 'pnpm-workspace.yaml'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(configPath, 'utf8')).toBe(existing)
  })

  it('propagates filesystem failures instead of reporting an unconfigured project as ready', async () => {
    const file = path.join(root, 'not-a-directory')
    await writeFile(file, '')

    await expect(ensurePnpmBuildPolicy(file)).rejects.toThrow()
  })
})
