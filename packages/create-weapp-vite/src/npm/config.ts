import type { Options as FetchOptions } from 'npm-registry-fetch'
import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import NpmConfig from '@npmcli/config'
import configDefinitions from '@npmcli/config/lib/definitions/index.js'
import { findPnpmWorkspaceRoot } from '../pnpmBuildPolicy'

export interface RegistryOptions extends Omit<FetchOptions, 'proxy'> {
  registry: string
  proxy?: string | false
  httpsProxy?: string | false
  noProxy?: string
  cafile?: string
  userconfig?: string
  strictSSL: boolean
  [key: string]: unknown
}

export interface ResolveRegistryOptions {
  registry?: string
  cwd?: string
  /** 以目标项目或最近 pnpm workspace 为安装边界，不继承普通父项目的 .npmrc。 */
  projectRoot?: string
}

const NPM_REGISTRY = 'https://registry.npmjs.org/'
const transportKeys = ['proxy', 'httpsProxy', 'noProxy', 'ca', 'strictSSL'] as const
const networkKeys = new Set<string>([...transportKeys, 'cert', 'key', 'localAddress'])
const npmNetworkKeys = new Set(['registry', 'proxy', 'https-proxy', 'noproxy', 'ca', 'cafile', 'strict-ssl', 'cert', 'key', 'local-address'])

function flattenNetworkConfig(data: Record<string, unknown>, flat: Record<string, unknown>) {
  // npm 完整的 flatten 会更新 process.env.user_agent 等值；这里只执行网络定义。
  const selected = Object.fromEntries(Object.entries(data).filter(([key]) =>
    npmNetworkKeys.has(key) || key.startsWith('//') || (key.startsWith('@') && key.endsWith(':registry')),
  ))
  configDefinitions.flatten(selected, flat)
}

function normalizeRegistry(value: unknown): string {
  try {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('invalid')
    }
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('invalid')
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
    return url.href
  }
  catch {
    throw new Error('registry 必须是有效的 HTTP(S) 地址，认证信息请放在 .npmrc 中，地址不能包含凭据、查询参数或片段。')
  }
}

/** 只展示源的地址，避免在诊断中暴露凭据或查询参数。 */
export function displayRegistry(registry: string): string {
  try {
    const url = new URL(registry)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  }
  catch {
    return '配置的 registry'
  }
}

async function findProjectConfigDir(cwd: string) {
  let current = path.resolve(cwd)
  while (true) {
    try {
      await Promise.any(['.npmrc', 'package.json', 'node_modules'].map(name => access(path.join(current, name))))
      return current
    }
    catch {
      const parent = path.dirname(current)
      if (parent === current) {
        return path.resolve(cwd)
      }
      current = parent
    }
  }
}

class ScaffoldNpmConfig extends NpmConfig {
  /** 创建目录可能尚不存在；使用调用者确定的安装边界。 */
  async loadLocalPrefix() {
    this.localPrefix = this.cwd
  }
}

/** 读取 npm 配置但不写文件，也不修改调用者环境或主动联网。 */
export async function resolveRegistryOptions(options: ResolveRegistryOptions = {}): Promise<RegistryOptions> {
  const env = { ...process.env }
  const override = options.registry
    ?? env.CREATE_WEAPP_VITE_REGISTRY
    ?? env.npm_config_registry
    ?? env.NPM_CONFIG_REGISTRY
    ?? env.pnpm_config_registry
    ?? env.PNPM_CONFIG_REGISTRY
  const registryOverride = override === undefined ? undefined : normalizeRegistry(override)
  if (registryOverride) {
    delete env.NPM_CONFIG_REGISTRY
    env.npm_config_registry = registryOverride
  }

  const target = path.resolve(options.projectRoot ?? options.cwd ?? process.cwd())
  const workspaceRoot = await findPnpmWorkspaceRoot(target)
  const cwd = workspaceRoot ?? (options.projectRoot ? target : await findProjectConfigDir(target))
  const configOptions = {
    ...configDefinitions,
    flatten: flattenNetworkConfig,
    npmPath: path.dirname(fileURLToPath(import.meta.resolve('@npmcli/config/package.json'))),
    cwd,
    env,
    argv: ['node', 'create-weapp-vite'],
    warn: false,
  }
  const config = new ScaffoldNpmConfig(configOptions)
  // npm 仅为 proxy 接受 false；脚手架对 https-proxy 提供同样的显式直连语义。
  config.types['https-proxy'] = config.types.proxy!
  try {
    await config.load()
    const flat: Record<string, unknown> = config.flat
    const resolved: RegistryOptions = {
      registry: registryOverride ?? normalizeRegistry(flat.registry ?? NPM_REGISTRY),
      strictSSL: flat.strictSSL !== false,
    }
    for (const [key, value] of Object.entries(flat)) {
      if (key.startsWith('@') && key.endsWith(':registry')) {
        resolved[key] = normalizeRegistry(value)
      }
      else if (networkKeys.has(key) || key.startsWith('//')) {
        if (value !== null && value !== undefined) {
          resolved[key] = value
        }
      }
    }
    if (resolved.proxy === undefined && resolved.httpsProxy === undefined) {
      resolved.httpsProxy = env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY
      resolved.proxy = env.http_proxy || env.HTTP_PROXY
    }
    resolved.noProxy = resolved.noProxy || env.no_proxy || env.NO_PROXY
    for (const key of ['cafile', 'userconfig'] as const) {
      const value = config.get(key)
      if (typeof value === 'string' && value) {
        resolved[key] = value
      }
    }
    return resolved
  }
  catch {
    throw new Error('无法读取 npm 网络配置，请检查 .npmrc、registry、代理与 CA 文件配置。')
  }
}

/** 按 npm 的作用域规则选择源，显式普通源不会覆盖作用域配置。 */
export function registryForPackage(packageName: string, options: RegistryOptions): string {
  const scope = packageName.startsWith('@') ? packageName.split('/')[0] : undefined
  return normalizeRegistry((scope && options[`${scope}:registry`]) || options.registry)
}

/** 公共源诊断仅复用传输配置，不携带私有源 token、作用域或客户端证书。 */
export function publicRegistryOptions(options: RegistryOptions, registry: string): RegistryOptions {
  const result: RegistryOptions = { registry: normalizeRegistry(registry), strictSSL: true }
  for (const key of transportKeys) {
    if (options[key] !== undefined) {
      Object.assign(result, { [key]: options[key] })
    }
  }
  return result
}

/** 仅向可选安装子进程透传网络参数，认证仍交给 npm 自行读取用户配置。 */
export function registryEnvironment(options: RegistryOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    npm_config_registry: options.registry,
    npm_config_strict_ssl: String(options.strictSSL),
  }
  const mappings = { proxy: 'proxy', httpsProxy: 'https_proxy', noProxy: 'noproxy', cafile: 'cafile', userconfig: 'userconfig' } as const
  for (const [key, name] of Object.entries(mappings)) {
    const value = options[key]
    if (value !== undefined) {
      env[`npm_config_${name}`] = String(value)
    }
  }
  if (!options.cafile && options.ca) {
    env.npm_config_ca = Array.isArray(options.ca) ? options.ca.join('\n') : String(options.ca)
  }
  return env
}
