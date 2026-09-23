import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- execa resolves Windows package-manager shims without invoking execFile on a .cmd file.
import { execa } from 'execa'
import { describe, expect, it, vi } from 'vitest'
import {
  changeAppTitle,
  cleanupChildProcessHandles,
  createPnpmCommand,
  createPnpmInstallCommand,
  readReceipt,
  shouldSkipTemplateFile,
  summarizeReport,
  waitForAppTitle,
  waitForChildClose,
} from '../../../scripts/create-weapp-vite-smoke.mjs'
import { createScenario, createTarballCommand, createTarballInstallCommand } from '../../../scripts/createWeappViteSmoke/commands.mjs'
import { classifyFailure, createPnpmProfileConfig, createRegistryEnvironment, resolveRegistryProfiles, resolveRegistryVersion, versionLag } from '../../../scripts/createWeappViteSmoke/registry.mjs'
import { assertPreparedProject, DEFAULT_TEMPLATE_NAMES, outputDirectory, validateCreatedProjectStructure } from '../../../scripts/createWeappViteSmoke/templates.mjs'
import { mergeSmokeReports, renderSmokeReport } from '../../../scripts/merge-create-weapp-vite-smoke-reports.mjs'
import { TemplateName } from '../src/enums'

describe('create-weapp-vite smoke helpers', () => {
  it('pins pnpm smoke commands through corepack', () => {
    expect(createPnpmCommand(['create', 'weapp-vite@latest', 'pnpm-default', 'default'])).toEqual({
      command: 'corepack',
      args: ['pnpm@12', 'create', 'weapp-vite@latest', 'pnpm-default', 'default'],
    })
  })

  it('runs normal pnpm installation so project postinstall and prepare execute', () => {
    expect(createPnpmInstallCommand()).toEqual({
      command: 'corepack',
      args: ['pnpm@12', 'install'],
    })
  })

  it('passes one explicit pnpm profile to create, install, build and dev instead of relying on npm_config environment variables', () => {
    const cacheRoot = path.join(os.tmpdir(), 'smoke-explicit-config')
    const profile = createPnpmProfileConfig({ registry: 'https://registry.npmjs.org/' }, cacheRoot)
    const scenario = createScenario('pnpm', profile)
    for (const command of [scenario.createCommand('app', 'default'), scenario.installCommand(), scenario.buildCommand(), scenario.devCommand()]) {
      expect(command.args.slice(1, 4)).toEqual([
        '--config.registry=https://registry.npmjs.org/',
        `--config.store-dir=${path.join(cacheRoot, 'pnpm-store')}`,
        `--config.state-dir=${path.join(cacheRoot, 'pnpm-state')}`,
      ])
      expect(command.args).toContain(`--config.cache-dir=${path.join(cacheRoot, 'pnpm-cache')}`)
      expect(command.args).toContain('--config.ignore-scripts=false')
    }
    const tarball = path.join(cacheRoot, 'scaffold.tgz')
    expect(createTarballInstallCommand(tarball, { registry: profile.registry, cache: cacheRoot }).args).toEqual([
      'install',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--registry=https://registry.npmjs.org/',
      `--cache=${cacheRoot}`,
      tarball,
    ])
  })

  it('covers every public template and uses the WeChat output of multi-platform templates', () => {
    expect(DEFAULT_TEMPLATE_NAMES.toSorted()).toEqual(Object.values(TemplateName).toSorted())
    expect(outputDirectory('multi-platform')).toBe('dist/weapp')
    expect(outputDirectory('multi-platform-sfc')).toBe('dist/weapp')
    expect(outputDirectory('react')).toBe('dist')
  })

  it.each(['pnpm', 'npm', 'yarn'])('keeps registry latest and opts out of skills in the %s create command', (manager) => {
    const command = createScenario(manager).createCommand('app', 'default', 'latest')
    expect(command.args).toContain(manager === 'yarn' ? 'weapp-vite' : 'weapp-vite@latest')
    expect(command.args.at(-1)).toBe('--no-install-skills')
    expect(command.args).not.toContain('weapp-vite@2.9.0')
    if (manager === 'npm') {
      expect(command.args.indexOf('--')).toBeLessThan(command.args.indexOf('app'))
    }
  })

  it('uses independent public registry profiles while preserving proxy and TLS configuration', () => {
    const [official, mirror] = resolveRegistryProfiles()
    const root = path.join(os.tmpdir(), 'smoke-cache-fixture')
    const baseEnv = { HTTPS_PROXY: 'http://localhost:3128', NODE_EXTRA_CA_CERTS: 'test-ca.pem' }
    const officialEnv = createRegistryEnvironment(official, path.join(root, 'official'), baseEnv)
    const mirrorEnv = createRegistryEnvironment(mirror, path.join(root, 'mirror'), baseEnv)
    expect(officialEnv.npm_config_registry).toBe('https://registry.npmjs.org/')
    expect(mirrorEnv.npm_config_registry).toBe('https://registry.npmmirror.com/')
    expect(mirrorEnv.npm_config_cache).not.toBe(officialEnv.npm_config_cache)
    expect(mirrorEnv.npm_config_store_dir).toBe(path.join(root, 'mirror/pnpm-store'))
    expect(mirrorEnv.npm_config_store_dir).not.toBe(officialEnv.npm_config_store_dir)
    expect(mirrorEnv.npm_config_cache_dir).not.toBe(officialEnv.npm_config_cache_dir)
    expect(mirrorEnv.npm_config_enable_global_virtual_store).toBe('false')
    expect(mirrorEnv.PNPM_CONFIG_REGISTRY).toBe('https://registry.npmmirror.com/')
    expect(mirrorEnv.PNPM_CONFIG_STORE_DIR).toBe(path.join(root, 'mirror/pnpm-store'))
    expect(mirrorEnv.PNPM_CONFIG_STATE_DIR).toBe(path.join(root, 'mirror/pnpm-state'))
    expect(mirrorEnv.PNPM_CONFIG_CACHE_DIR).toBe(path.join(root, 'mirror/pnpm-cache'))
    expect(mirrorEnv.PNPM_CONFIG_ENABLE_GLOBAL_VIRTUAL_STORE).toBe('false')
    expect(mirrorEnv.PNPM_CONFIG_IGNORE_SCRIPTS).toBe('false')
    expect(mirrorEnv.PNPM_CONFIG_FETCH_RETRIES).toBe('1')
    expect(mirrorEnv.PNPM_CONFIG_FETCH_TIMEOUT).toBe('30000')
    expect(mirrorEnv.pnpm_config_registry).toBe(mirrorEnv.PNPM_CONFIG_REGISTRY)
    expect(mirrorEnv.pnpm_config_store_dir).toBe(mirrorEnv.PNPM_CONFIG_STORE_DIR)
    expect(mirrorEnv.XDG_CACHE_HOME).not.toBe(officialEnv.XDG_CACHE_HOME)
    expect(mirrorEnv).toMatchObject(baseEnv)
    expect(() => resolveRegistryProfiles('unknown')).toThrow('Unknown registry profile')
  })

  it('preserves the profile in a pnpm subprocess without forwarding CLI configuration', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-native-config-'))
    try {
      const project = path.join(root, 'project')
      await fs.mkdir(project)
      await fs.writeFile(path.join(project, 'package.json'), '{"name":"config-fixture","private":true}')
      await fs.writeFile(path.join(project, 'pnpm-workspace.yaml'), 'packages: []\n')
      const env = createRegistryEnvironment({ registry: 'https://registry.npmmirror.com/' }, root)
      for (const [key, expected] of [
        ['registry', 'https://registry.npmmirror.com/'],
        ['storeDir', path.join(root, 'pnpm-store')],
        ['stateDir', path.join(root, 'pnpm-state')],
        ['cacheDir', path.join(root, 'pnpm-cache')],
      ] as const) {
        const args = ['--dir', project, 'config', 'get', key, '--json']
        const { stdout } = await execa('pnpm', args, {
          cwd: path.resolve(import.meta.dirname, '..'),
          env: {
            ...env,
            // 只读探针复用已安装的 pnpm，禁止 Corepack 联网或下载另一份 CLI。
            XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
            COREPACK_ENABLE_NETWORK: '0',
          },
          timeout: 10_000,
        })
        expect(JSON.parse(stdout), key).toBe(expected)
      }
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('queries each registry own latest without replacing a lagging mirror version', async () => {
    const [official, mirror] = resolveRegistryProfiles()
    const execute = vi.fn().mockResolvedValueOnce({ stdout: '"2.9.0"' }).mockResolvedValueOnce({ stdout: '"2.8.17"' })
    expect(await resolveRegistryVersion(official, 'latest', '.', {}, execute)).toBe('2.9.0')
    expect(await resolveRegistryVersion(mirror, 'latest', '.', {}, execute)).toBe('2.8.17')
    expect(execute.mock.calls[1]?.[0].args).toContain('create-weapp-vite@latest')
    expect(execute.mock.calls[1]?.[0].args).toContain('https://registry.npmmirror.com/')
    expect(versionLag('2.8.17', '2.9.0')).toBe('behind')
    expect(versionLag('2.10.0', '2.9.0')).toBe('ahead')
    expect(versionLag('2.9.0', null)).toBe('unknown')
    expect(versionLag('2.9.1', '2.9.0', true)).toBe('local-artifact')
  })

  it.each([
    ['ENOTFOUND registry.npmmirror.com', 'install', 'network'],
    ['ECONNRESET during metadata fetch', 'registry', 'network'],
    ['certificate has expired', 'create', 'network'],
    ['Timed out after 20000ms', 'registry', 'network'],
    ['ERR_PNPM_NO_MATCHING_VERSION No matching version found', 'install', 'registry-unavailable'],
    ['E404 Not Found', 'registry', 'registry-unavailable'],
    ['Build failed: unexpected token', 'build', 'product'],
    ['Timed out waiting for dev outputs', 'dev', 'product'],
  ])('classifies %s during %s as %s', (message, stage, kind) => {
    expect(classifyFailure(new Error(message), { registryProfile: 'npmmirror', stage })).toBe(kind)
  })

  it('does not label missing official dependencies as mirror lag', () => {
    expect(classifyFailure(new Error('E404 Not Found'), { registryProfile: 'npmjs', stage: 'install' })).toBe('product')
  })

  it('captures the actual executed package version even when registry metadata differs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-receipt-'))
    try {
      const packageRoot = path.join(root, 'node_modules', 'create-weapp-vite')
      const bin = path.join(packageRoot, 'bin', 'create-weapp-vite.mjs')
      const receiptFile = path.join(root, 'receipt.json')
      await fs.mkdir(path.dirname(bin), { recursive: true })
      await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'create-weapp-vite', version: '2.8.17', bin: './bin/create-weapp-vite.mjs' }))
      await fs.writeFile(bin, '')
      const capture = new URL('../../../scripts/createWeappViteSmoke/capture.mjs', import.meta.url)
      await promisify(execFile)(process.execPath, ['--import', capture.href, bin], { env: { ...process.env, CREATE_WEAPP_VITE_RECEIPT: receiptFile } })
      const receipt = await readReceipt(receiptFile)
      expect(receipt.version).toBe('2.8.17')
      expect(versionLag(receipt.version, '2.9.0')).toBe('behind')
      const command = await createTarballCommand(packageRoot, 'app', 'wevu')
      expect(command.command).toBe(process.execPath)
      expect(command.args).toEqual([bin, 'app', 'wevu', '--no-install-skills'])
      expect(createTarballInstallCommand(path.join(root, 'packed.tgz')).args).toEqual(['install', '--no-audit', '--no-fund', '--package-lock=false', path.join(root, 'packed.tgz')])
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('checks the executed package templates and verifies prepare outputs before build', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-structure-'))
    try {
      const packageRoot = path.join(root, 'package')
      const projectRoot = path.join(root, 'project')
      await fs.mkdir(path.join(packageRoot, 'templates/default'), { recursive: true })
      await fs.mkdir(projectRoot)
      await fs.writeFile(path.join(packageRoot, 'templates/default/package.json'), '{}')
      await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ scripts: { postinstall: 'wv prepare' } }))
      await fs.writeFile(path.join(projectRoot, 'AGENTS.md'), '')
      await expect(validateCreatedProjectStructure(projectRoot, 'default', 'unit', packageRoot)).resolves.toBeUndefined()
      await expect(assertPreparedProject(projectRoot)).rejects.toThrow('tsconfig.app.json')
      await fs.mkdir(path.join(projectRoot, '.weapp-vite'))
      for (const filename of ['tsconfig.app.json', 'tsconfig.shared.json']) {
        await fs.writeFile(path.join(projectRoot, '.weapp-vite', filename), '{}')
      }
      await expect(assertPreparedProject(projectRoot)).resolves.toBeUndefined()
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('keeps version lag, product failures and environment limitations visible after report merging', () => {
    const registries = [{ name: 'npmmirror', resolvedVersion: '2.8.17', expectedOfficialVersion: '2.9.0', lag: 'behind' }]
    const results = [{ registryProfile: 'npmmirror', scenario: 'pnpm', template: 'wevu', actualCreateVersion: '2.8.17', expectedOfficialVersion: '2.9.0', lag: 'behind' }]
    expect(summarizeReport({ registries, failures: [] }).status).toBe('passed-with-registry-lag')
    expect(summarizeReport({ registries: [], results, failures: [] }).laggingRegistries).toEqual(['npmmirror'])
    const failures = [{ registryProfile: 'npmmirror', kind: 'network', stage: 'registry', error: 'ENOTFOUND' }]
    const summary = summarizeReport({ registries, failures })
    expect(summary.status).toBe('environment-limited')
    const merged = mergeSmokeReports([{ os: 'linux', nodeVersion: '24', registries, results, failures, summary }])
    expect(merged.rows[0].actualCreateVersion).toBe('2.8.17')
    expect(merged.failures[0].kind).toBe('network')
    expect(renderSmokeReport(merged)).toContain('Network/environment failures: 1')
    expect(renderSmokeReport(merged)).toContain('2.8.17 | 2.9.0 | behind')
    expect(summarizeReport({ registries, failures: [...failures, { kind: 'product' }] }).status).toBe('product-failure')
  })

  it('makes a semantic app title update for every shipped native and SFC template', async () => {
    for (const name of DEFAULT_TEMPLATE_NAMES) {
      const root = path.resolve(import.meta.dirname, '../templates', name, 'src')
      let extension = '.json'
      const source = await fs.readFile(path.join(root, 'app.json'), 'utf8').catch(async () => {
        extension = '.vue'
        return fs.readFile(path.join(root, 'app.vue'), 'utf8')
      })
      const changed = changeAppTitle(source, extension, 'smoke-updated')
      expect(changed).not.toBe(source)
      if (extension === '.json') {
        const config = JSON.parse(changed) as { window: { navigationBarTitleText: string } }
        expect(config.window.navigationBarTitleText).toBe('smoke-updated')
      }
      else {
        expect(changed).toContain('navigationBarTitleText: "smoke-updated"')
        expect(changed).toContain('defineAppJson(')
      }
    }
  })

  it('ignores generated template dist output directories in structure checks', () => {
    const templateRoot = path.join(os.tmpdir(), 'create-weapp-vite-smoke-template')

    expect(shouldSkipTemplateFile(path.join(templateRoot, 'src', 'app.json'), templateRoot)).toBe(false)
    expect(shouldSkipTemplateFile(path.join(templateRoot, 'src', 'distribution', 'index.ts'), templateRoot)).toBe(false)
    expect(shouldSkipTemplateFile(path.join(templateRoot, 'dist', 'app.js'), templateRoot)).toBe(true)
    expect(shouldSkipTemplateFile(path.join(templateRoot, 'dist-plugin', 'plugin.js'), templateRoot)).toBe(true)
    expect(shouldSkipTemplateFile(path.join(templateRoot, 'src', 'features', 'dist-web', 'app.js'), templateRoot)).toBe(true)
  })

  it('requires the expected emitted app title and rejects an unchanged output', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-smoke-test-'))
    const distFile = path.join(tempRoot, 'app.json')
    try {
      await fs.writeFile(distFile, '{"pages":["pages/index/index"]}\n', 'utf8')
      await expect(waitForAppTitle(distFile, 'smoke-updated', 30, 5)).rejects.toThrow('updated app title')
      const pending = waitForAppTitle(distFile, 'smoke-updated', 500, 10)
      await fs.writeFile(distFile, '{"window":{"navigationBarTitleText":"smoke-updated"}}\n')
      await expect(pending).resolves.toBeGreaterThanOrEqual(0)
    }
    finally {
      await fs.rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('force-cleans lingering dev child handles when close never arrives', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null
      stdout: { destroy: ReturnType<typeof vi.fn> }
      stderr: { destroy: ReturnType<typeof vi.fn> }
      stdin: { destroy: ReturnType<typeof vi.fn> }
      unref: ReturnType<typeof vi.fn>
      removeAllListeners: EventEmitter['removeAllListeners']
    }

    child.exitCode = null
    child.stdout = { destroy: vi.fn() }
    child.stderr = { destroy: vi.fn() }
    child.stdin = { destroy: vi.fn() }
    child.unref = vi.fn()

    await expect(waitForChildClose(child, 20)).resolves.toBe(false)

    cleanupChildProcessHandles(child)

    expect(child.stdout.destroy).toHaveBeenCalledTimes(1)
    expect(child.stderr.destroy).toHaveBeenCalledTimes(1)
    expect(child.stdin.destroy).toHaveBeenCalledTimes(1)
    expect(child.unref).toHaveBeenCalledTimes(1)
  })

  it('waits for close even after exitCode is already set', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null
    }

    child.exitCode = 0

    setTimeout(() => {
      child.emit('close')
    }, 20)

    await expect(waitForChildClose(child, 100)).resolves.toBe(true)
  })
})
