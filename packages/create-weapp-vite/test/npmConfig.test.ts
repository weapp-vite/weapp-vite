import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 与脚手架一致地解析 Windows 的 npm/pnpm 命令。
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { displayRegistry, publicRegistryOptions, registryEnvironment, registryForPackage, resolveRegistryOptions } from '../src/npm'

let root: string
let project: string
let userconfig: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'scaffold-npm-config-'))
  project = path.join(root, 'project')
  userconfig = path.join(root, 'user.npmrc')
  await mkdir(project)
  for (const name of Object.keys(process.env)) {
    if (/^(?:npm_config_|pnpm_config_|create_weapp_vite_registry$|https?_proxy$|no_proxy$)/i.test(name)) {
      vi.stubEnv(name, undefined)
    }
  }
  vi.stubEnv('npm_config_userconfig', userconfig)
  vi.stubEnv('npm_config_globalconfig', path.join(root, 'global.npmrc'))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('npm network configuration', () => {
  it('uses npm defaults without writing config or mutating the environment', async () => {
    const before = { ...process.env }
    const options = await resolveRegistryOptions({ cwd: project })
    expect(options.registry).toBe('https://registry.npmjs.org/')
    expect(options.strictSSL).toBe(true)
    expect(process.env).toEqual(before)
    await expect(readFile(userconfig)).rejects.toThrow()
  })

  it('loads the nearest ancestor .npmrc even without a package manifest', async () => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, '.npmrc'), 'registry=https://ancestor.example/\n')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://ancestor.example/')
    await writeFile(path.join(project, '.npmrc'), 'registry=https://project.example/npm\n')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://project.example/npm/')
  })

  it('stops ancestor lookup at the nearest package boundary', async () => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, '.npmrc'), 'registry=https://parent.example/\n')
    await writeFile(path.join(project, 'package.json'), '{"name":"network-fixture","private":true}')
    const nested = path.join(project, 'src')
    await mkdir(nested)
    expect((await resolveRegistryOptions({ cwd: nested })).registry).toBe('https://user.example/')
  })

  it.each(['npm', 'pnpm'])('matches %s in a newly generated project without inheriting parent authentication', async (command) => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, '.npmrc'), [
      'registry=https://parent.example/',
      '@weapp-vite:registry=https://private.example/',
      '//private.example/:_authToken=fixture-parent-token',
    ].join('\n'))
    const target = path.join(project, 'new-app')
    const beforeCreation = await resolveRegistryOptions({ projectRoot: target })
    expect(beforeCreation.registry).toBe('https://user.example/')
    expect(beforeCreation['@weapp-vite:registry']).toBeUndefined()
    expect(beforeCreation['//private.example/:_authToken']).toBeUndefined()
    await mkdir(target)
    await writeFile(path.join(target, 'package.json'), '{"name":"network-fixture","private":true}')
    const result = await execa(command, ['config', 'get', 'registry'], { cwd: target })
    expect(result.stdout.trim()).toBe(beforeCreation.registry)
    await writeFile(path.join(target, '.npmrc'), 'registry=https://target.example/\n')
    const existing = await resolveRegistryOptions({ projectRoot: target })
    const targetResult = await execa(command, ['config', 'get', 'registry'], { cwd: target })
    expect(targetResult.stdout.trim()).toBe(existing.registry)
  })

  it.each(['project', 'unlisted'])('matches pnpm workspace configuration for %s regardless of membership or child npmrc', async (name) => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - project\n')
    await writeFile(path.join(root, '.npmrc'), [
      'registry=https://workspace.example/',
      '@weapp-vite:registry=https://workspace-private.example/',
      '//workspace-private.example/:_authToken=fixture-workspace-token',
    ].join('\n'))
    const target = path.join(root, name)
    await mkdir(target, { recursive: true })
    await writeFile(path.join(target, 'package.json'), '{"name":"network-fixture","private":true}')
    await writeFile(path.join(target, '.npmrc'), [
      'registry=https://child.example/',
      '//child.example/:_authToken=fixture-child-token',
    ].join('\n'))
    const nested = path.join(target, 'src')
    await mkdir(nested)
    const network = await resolveRegistryOptions({ projectRoot: target })
    const fromCwd = await resolveRegistryOptions({ cwd: nested })
    const actual = await execa('pnpm', ['config', 'get', 'registry'], { cwd: target })
    expect(actual.stdout.trim()).toBe('https://workspace.example/')
    expect(network.registry).toBe(actual.stdout.trim())
    expect(fromCwd.registry).toBe(actual.stdout.trim())
    expect(registryForPackage('@weapp-vite/dashboard', network)).toBe('https://workspace-private.example/')
    expect(network['//workspace-private.example/:_authToken']).toBe('fixture-workspace-token')
    expect(network['//child.example/:_authToken']).toBeUndefined()
  })

  it('uses the existing workspace before a target directory is created', async () => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - project/*\n')
    await writeFile(path.join(root, '.npmrc'), 'registry=https://workspace.example/\n')
    const target = path.join(project, 'new-app')
    const beforeCreation = await resolveRegistryOptions({ projectRoot: target })
    await mkdir(target)
    await writeFile(path.join(target, 'package.json'), '{"name":"network-fixture","private":true}')
    const actual = await execa('pnpm', ['config', 'get', 'registry'], { cwd: target })
    expect(actual.stdout.trim()).toBe('https://workspace.example/')
    expect(beforeCreation.registry).toBe(actual.stdout.trim())
  })

  it('respects a nested standalone workspace instead of the ancestor configuration', async () => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - project\n')
    await writeFile(path.join(root, '.npmrc'), 'registry=https://workspace.example/\n')
    await writeFile(path.join(project, 'pnpm-workspace.yaml'), 'packages: []\n')
    // 即使目标尚未生成 package.json，自身 workspace 已经确定安装配置边界。
    const fromCwd = await resolveRegistryOptions({ cwd: project })
    const fromProject = await resolveRegistryOptions({ projectRoot: project })
    await writeFile(path.join(project, 'package.json'), '{"name":"network-fixture","private":true}')
    const actual = await execa('pnpm', ['config', 'get', 'registry'], { cwd: project })
    expect(actual.stdout.trim()).toBe('https://user.example/')
    expect(fromCwd.registry).toBe(actual.stdout.trim())
    expect(fromProject.registry).toBe(actual.stdout.trim())
  })

  it('respects explicit, app environment, npm environment, project and user precedence', async () => {
    await writeFile(userconfig, 'registry=https://user.example/\n')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://user.example/')
    await writeFile(path.join(project, '.npmrc'), 'registry=https://project.example/\n')
    vi.stubEnv('pnpm_config_registry', 'https://pnpm.example/')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://pnpm.example/')
    vi.stubEnv('NPM_CONFIG_REGISTRY', 'https://upper.example/')
    vi.stubEnv('npm_config_registry', 'https://environment.example/')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://environment.example/')
    vi.stubEnv('CREATE_WEAPP_VITE_REGISTRY', 'https://app.example/')
    expect((await resolveRegistryOptions({ cwd: project })).registry).toBe('https://app.example/')
    expect((await resolveRegistryOptions({ cwd: project, registry: 'https://explicit.example/' })).registry).toBe('https://explicit.example/')
  })

  it('loads scope/auth, CA and proxy configuration with npm environment expansion', async () => {
    vi.stubEnv('SCAFFOLD_FIXTURE_TOKEN', 'fixture-token')
    const caFile = path.join(root, 'ca.pem')
    await writeFile(caFile, '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----\n')
    await writeFile(userconfig, [
      '@weapp-vite:registry=https://private.example/npm/',
      // eslint-disable-next-line no-template-curly-in-string -- 验证 npmrc 的环境变量插值语法。
      '//private.example/npm/:_authToken=${SCAFFOLD_FIXTURE_TOKEN}',
      'https-proxy=http://proxy.example:8080',
      'noproxy=localhost,.internal.example',
      `cafile=${caFile}`,
    ].join('\n'))
    const options = await resolveRegistryOptions({ cwd: project })
    expect(registryForPackage('@weapp-vite/dashboard', options)).toBe('https://private.example/npm/')
    expect(options['//private.example/npm/:_authToken']).toBe('fixture-token')
    expect(options.httpsProxy).toBe('http://proxy.example:8080')
    expect(options.noProxy).toBe('localhost,.internal.example')
    expect(options.ca).toEqual(['-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----'])
    expect(options.strictSSL).toBe(true)
    const child = registryEnvironment(options)
    expect(child.npm_config_cafile).toBe(caFile)
    expect(child.npm_config_userconfig).toBe(userconfig)
    expect(JSON.stringify(child)).not.toContain('fixture-token')
  })

  it('honors proxy environment variables and NO_PROXY', async () => {
    vi.stubEnv('HTTPS_PROXY', 'http://proxy.example:8080')
    vi.stubEnv('NO_PROXY', 'registry.example,.internal.example')
    const options = await resolveRegistryOptions({ cwd: project })
    expect(options.httpsProxy).toBe('http://proxy.example:8080')
    expect(options.noProxy).toBe('registry.example,.internal.example')
  })

  it('does not override an explicit npm proxy or disabled proxy with HTTPS_PROXY', async () => {
    vi.stubEnv('HTTPS_PROXY', 'http://environment-proxy.example:8080')
    await writeFile(userconfig, 'proxy=http://configured-proxy.example:8080\n')
    const configured = await resolveRegistryOptions({ cwd: project })
    expect(configured.proxy).toBe('http://configured-proxy.example:8080')
    expect(configured.httpsProxy).toBeUndefined()
    await writeFile(userconfig, 'proxy=false\n')
    const disabled = await resolveRegistryOptions({ cwd: project })
    expect(disabled.proxy).toBe(false)
    expect(disabled.httpsProxy).toBeUndefined()
  })

  it('keeps scope overrides when a general registry is explicitly selected', async () => {
    await writeFile(userconfig, '@weapp-vite:registry=https://private.example/\n')
    const options = await resolveRegistryOptions({ cwd: project, registry: 'https://mirror.example/' })
    expect(registryForPackage('weapp-vite', options)).toBe('https://mirror.example/')
    expect(registryForPackage('@weapp-vite/dashboard', options)).toBe('https://private.example/')
  })

  it.each(['', 'file:///tmp/packages', 'invalid', 'https://name:secret@registry.example/', 'https://registry.example/?token=secret'])('rejects unsafe registry %s without leaking its value', async (value) => {
    const result = resolveRegistryOptions({ cwd: project, registry: value })
    await expect(result).rejects.toThrow('registry 必须')
    await expect(result).rejects.not.toThrow('secret')
  })

  it('strips credentials, scope overrides and client certificates for public diagnostics', () => {
    const options = publicRegistryOptions({
      'registry': 'https://private.example/',
      'strictSSL': true,
      'proxy': 'http://proxy.example:8080',
      'ca': ['fixture-ca'],
      'cert': 'fixture-client-cert',
      'key': 'fixture-client-key',
      '//private.example/:_authToken': 'fixture-token',
      '@weapp-vite:registry': 'https://private.example/',
    }, 'https://registry.npmjs.org/')
    expect(options).toEqual({ registry: 'https://registry.npmjs.org/', strictSSL: true, proxy: 'http://proxy.example:8080', ca: ['fixture-ca'] })
    expect(displayRegistry('https://name:secret@registry.example/path/?token=secret#secret')).toBe('https://registry.example/path/')
    expect(displayRegistry('invalid-secret')).toBe('配置的 registry')
  })
})
