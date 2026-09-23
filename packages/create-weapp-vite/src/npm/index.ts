import type { RegistryOptions } from './config'
import { displayRegistry, registryForPackage, resolveRegistryOptions } from './config'
import { requestMetadata } from './transport'

export { displayRegistry, publicRegistryOptions, registryEnvironment, registryForPackage, resolveRegistryOptions } from './config'
export type { RegistryOptions, ResolveRegistryOptions } from './config'

const REQUEST_TIMEOUT_MS = 5_000

function requestError(error: unknown, registry: string): Error {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0
  const reason = status >= 400 && status <= 599
    ? `HTTP ${status}`
    : ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT'].includes(code)
        ? code
        : '连接失败或响应无效'
  return new Error(`registry ${displayRegistry(registry)} 查询失败（${reason}）`)
}

async function requestJson(packageName: string, suffix = '', signal?: AbortSignal, options?: RegistryOptions): Promise<unknown> {
  if (signal?.aborted) {
    throw new Error('registry 查询已取消')
  }
  const resolved = options ?? await resolveRegistryOptions()
  const registry = registryForPackage(packageName, resolved)
  const controller = new AbortController()
  let rejectDeadline: (error: Error) => void = () => {}
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject
  })
  function cancel(message: string) {
    const error = new Error(message)
    controller.abort(error)
    rejectDeadline(error)
  }
  const abort = () => cancel('registry 查询已取消')
  const timer = setTimeout(cancel, REQUEST_TIMEOUT_MS, `registry 查询超过 ${REQUEST_TIMEOUT_MS / 1000} 秒`)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) {
    abort()
  }
  try {
    // 总期限包括重试和响应体读取，不依赖单个 socket 的超时计时。
    const metadata = requestMetadata(`${registry}${encodeURIComponent(packageName)}${suffix}`, { ...resolved, registry }, controller.signal, REQUEST_TIMEOUT_MS)
    return await Promise.race([metadata, deadline])
  }
  catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason
    }
    throw requestError(error, registry)
  }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 从配置的 npm registry 获取包的已发布版本列表。 */
export async function getPackageVersionsFromNpm(packageName: string, signal?: AbortSignal, options?: RegistryOptions): Promise<string[]> {
  const metadata = await requestJson(packageName, '', signal, options)
  if (!isRecord(metadata) || !isRecord(metadata.versions)) {
    throw new Error('registry 响应缺少有效的 versions 信息')
  }
  return Object.keys(metadata.versions)
}

/** 从配置的 npm registry 获取包的最新版本号。 */
export async function getLatestVersionFromNpm(packageName: string, signal?: AbortSignal, options?: RegistryOptions): Promise<string> {
  const metadata = await requestJson(packageName, '/latest', signal, options)
  if (!isRecord(metadata) || typeof metadata.version !== 'string' || !metadata.version) {
    throw new Error('registry 响应缺少有效的 version 信息')
  }
  return metadata.version
}

export async function latestVersion(
  packageName: string,
  prefix: string = '^',
  fetch: typeof getLatestVersionFromNpm = getLatestVersionFromNpm,
) {
  try {
    const resolved = await fetch(packageName)
    return resolved ? `${prefix}${resolved}` : null
  }
  catch {
    return null
  }
}
