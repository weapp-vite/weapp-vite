import path from 'node:path'
import process from 'node:process'
import { runCommand } from './process.mjs'

export const REGISTRY_PROFILES = {
  npmjs: 'https://registry.npmjs.org/',
  npmmirror: 'https://registry.npmmirror.com/',
}
const NETWORK_ERROR_RE = /\b(?:EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ECONNABORTED|ENETUNREACH|EHOSTUNREACH|EPIPE|E(?:HTTP)?(?:401|403|429|50\d)|ERR_PNPM_FETCH_(?:401|403|429|50\d)|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN)\b|fetch failed|failed to fetch|error sending request:\s*operation timed out|socket hang up|certificate|(?:HTTP|status(?: code)?)[\s:=]*(?:401|403|429|50\d)/i
const REGISTRY_MISSING_RE = /\b(?:E404|ETARGET|ERR_PNPM_NO_MATCHING_VERSION|ERR_PNPM_FETCH_404)\b|404 Not Found/i
const LIFECYCLE_OUTPUT_RE = /\b(?:preinstall|postinstall|prepare|prepublish(?:Only)?|prebuild|postbuild)\b|\b(?:install|build)\s*[:$]|(?:^|\n)\s*>[^\n]*\b(?:install|build)\b|(?:^|\n)[^\n]*[>$]\s*(?:wv|vite|rollup|rolldown|tsc)\b/i
const PRODUCT_ERROR_RE = /\b(?:ERR_PNPM_(?:IGNORED_BUILDS|PEER_DEP_ISSUES|UNSUPPORTED_ENGINE|NO_SCRIPT|OUTDATED_LOCKFILE|LOCKFILE_BREAKING_CHANGE)|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION)\b/i

export function resolveRegistryProfiles(value = 'npmjs,npmmirror') {
  return [...new Set(value.split(',').map(name => name.trim()).filter(Boolean))].map((name) => {
    const registry = REGISTRY_PROFILES[name]
    if (!registry) {
      throw new Error(`Unknown registry profile: ${name}`)
    }
    return { name, registry }
  })
}

/**
 * 为 npm 与 pnpm 子进程生成同一份源和缓存配置。
 * @returns {NodeJS.ProcessEnv} 可继承的进程环境。
 */
export function createRegistryEnvironment(profile, cacheRoot, baseEnv = process.env) {
  // pnpm 的内部安装进程不转发外层 CLI 参数；原生入口只读取 PNPM_CONFIG_*。
  const pnpmEnvironment = Object.fromEntries(Object.entries(createPnpmProfileConfig(profile, cacheRoot)).flatMap(([key, value]) => {
    const suffix = key.replaceAll('-', '_')
    return [[`PNPM_CONFIG_${suffix.toUpperCase()}`, String(value)], [`pnpm_config_${suffix}`, String(value)]]
  }))
  return {
    ...baseEnv,
    ...pnpmEnvironment,
    CI: 'true',
    npm_config_yes: 'true',
    npm_config_ignore_scripts: 'false',
    NPM_CONFIG_IGNORE_SCRIPTS: 'false',
    npm_config_registry: profile.registry,
    NPM_CONFIG_REGISTRY: profile.registry,
    COREPACK_NPM_REGISTRY: profile.registry.replace(/\/$/, ''),
    YARN_REGISTRY: profile.registry,
    npm_config_cache: path.join(cacheRoot, 'npm'),
    NPM_CONFIG_CACHE: path.join(cacheRoot, 'npm'),
    npm_config_store_dir: path.join(cacheRoot, 'pnpm-store'),
    NPM_CONFIG_STORE_DIR: path.join(cacheRoot, 'pnpm-store'),
    npm_config_cache_dir: path.join(cacheRoot, 'pnpm-cache'),
    NPM_CONFIG_CACHE_DIR: path.join(cacheRoot, 'pnpm-cache'),
    npm_config_enable_global_virtual_store: 'false',
    NPM_CONFIG_ENABLE_GLOBAL_VIRTUAL_STORE: 'false',
    XDG_CACHE_HOME: path.join(cacheRoot, 'xdg'),
    YARN_CACHE_FOLDER: path.join(cacheRoot, 'yarn'),
    npm_config_fetch_retries: '1',
    npm_config_fetch_timeout: '30000',
  }
}

/** 用同一份 profile 生成 CLI 参数和可被内部 pnpm 子进程继承的环境变量。 */
export function createPnpmProfileConfig(profile, cacheRoot) {
  return {
    'registry': profile.registry,
    'store-dir': path.join(cacheRoot, 'pnpm-store'),
    'state-dir': path.join(cacheRoot, 'pnpm-state'),
    'cache-dir': path.join(cacheRoot, 'pnpm-cache'),
    'enable-global-virtual-store': false,
    'ignore-scripts': false,
    'fetch-retries': 1,
    'fetch-timeout': 30_000,
  }
}

export function classifyFailure(error, { registryProfile, stage }) {
  const message = error instanceof Error ? error.message : String(error)
  if (PRODUCT_ERROR_RE.test(message)) {
    return 'product'
  }
  const lifecycleFailure = /\b(?:ELIFECYCLE|ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL)\b/i.test(message)
    || (/timed out/i.test(message) && (['prepare', 'build', 'dev'].includes(stage) || LIFECYCLE_OUTPUT_RE.test(message)))
  // 生命周期已失败时，之前的重试警告不能盖过最终错误；明确的网络错误仍保留。
  const networkEvidence = lifecycleFailure
    ? message.split(/\r?\n/).filter(line => !/\bwarn(?:ing)?\b/i.test(line)).join('\n')
    : message
  const downloadTimeout = ['create', 'install'].includes(stage)
    && /Timed out after \d+ms/i.test(message)
    && /\bDownloading\b/i.test(message)
    && !LIFECYCLE_OUTPUT_RE.test(message)
  if (NETWORK_ERROR_RE.test(networkEvidence) || downloadTimeout || (stage === 'registry' && /timed out/i.test(message))) {
    return 'network'
  }
  if (registryProfile === 'npmmirror' && ['registry', 'create', 'install'].includes(stage) && REGISTRY_MISSING_RE.test(message)) {
    return 'registry-unavailable'
  }
  return 'product'
}

export function versionLag(actualVersion, expectedVersion, localArtifact = false) {
  if (localArtifact) {
    return 'local-artifact'
  }
  if (!actualVersion || !expectedVersion) {
    return 'unknown'
  }
  if (actualVersion === expectedVersion) {
    return 'current'
  }
  const actual = actualVersion.split(/[.-]/).slice(0, 3).map(Number)
  const expected = expectedVersion.split(/[.-]/).slice(0, 3).map(Number)
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== expected[i]) {
      return actual[i] < expected[i] ? 'behind' : 'ahead'
    }
  }
  return 'different'
}

export async function resolveRegistryVersion(profile, packageSpec, cwd, env, execute = runCommand) {
  const { stdout } = await execute({
    command: 'npm',
    args: ['view', `create-weapp-vite@${packageSpec}`, 'version', '--json', '--registry', profile.registry, '--fetch-retries=0', '--fetch-timeout=15000'],
    cwd,
    env,
    timeoutMs: 20_000,
    label: `${profile.name} scaffold metadata`,
    quiet: true,
  })
  const version = JSON.parse(stdout.trim())
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i.test(version)) {
    throw new Error(`Registry ${profile.name} returned an invalid create-weapp-vite version`)
  }
  return version
}

/** 报告脱敏仅去掉本次临时目录和用户目录，不隐藏产品错误内容。 */
export function reportError(error, roots = []) {
  let message = error instanceof Error ? error.message : String(error)
  for (const root of roots.filter(Boolean)) {
    message = message.replaceAll(root, '<temporary>')
  }
  return message
}
