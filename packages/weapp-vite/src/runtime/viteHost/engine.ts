import type * as RolldownExperimental from 'rolldown/experimental'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

interface PackageIdentity {
  name: string
  version: string
}

export interface ViteHostIdentity {
  kind: 'vite' | 'vite-plus'
  packagePath: string
  packageVersion: string
  experimentalPath: string
}

function readIdentity(file: string): PackageIdentity {
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!value || typeof value !== 'object'
    || !('name' in value) || typeof value.name !== 'string'
    || !('version' in value) || typeof value.version !== 'string') {
    throw new Error('[weapp-vite] Vite 宿主 package.json 缺少 name/version。')
  }
  return { name: value.name, version: value.version }
}

/** 按宿主的真实导出解析引擎，不依赖扁平 node_modules 布局或版本号相等。 */
export function resolveViteHost(importer: string | URL = import.meta.url): ViteHostIdentity {
  const resolve = createRequire(importer)
  const packagePath = resolve.resolve('vite/package.json')
  const identity = readIdentity(packagePath)
  const hostRequire = createRequire(packagePath)
  if (identity.name === '@voidzero-dev/vite-plus-core') {
    return {
      kind: 'vite-plus',
      packagePath,
      packageVersion: identity.version,
      experimentalPath: hostRequire.resolve('@voidzero-dev/vite-plus-core/rolldown/experimental'),
    }
  }
  if (identity.name !== 'vite') {
    throw new Error(`[weapp-vite] 不支持的 Vite 宿主：${identity.name}@${identity.version}。`)
  }
  return {
    kind: 'vite',
    packagePath,
    packageVersion: identity.version,
    experimentalPath: hostRequire.resolve('rolldown/experimental'),
  }
}

/** 加载与宿主绑定的引擎；缺失能力时保留原始错误，禁止回退到另一套引擎。 */
export async function loadHostRolldown(importer?: string | URL): Promise<typeof RolldownExperimental> {
  let identity: ViteHostIdentity | undefined
  try {
    identity = resolveViteHost(importer)
    const runtime = await import(pathToFileURL(identity.experimentalPath).href) as typeof RolldownExperimental
    if (typeof runtime.dev !== 'function' || typeof runtime.scan !== 'function') {
      throw new TypeError('Rolldown 缺少 dev/scan 能力')
    }
    return runtime
  }
  catch (cause) {
    const host = identity ? `${identity.kind}@${identity.packageVersion}` : 'vite'
    throw new Error(`[weapp-vite] 无法加载 ${host} 配套的 Rolldown；请检查宿主依赖和 Vite+ alias 配置。`, { cause })
  }
}

/** 原生输出写出也绑定宿主引擎，避免 Vite+ 额外加载包内另一套 Rolldown。 */
export async function loadHostRolldownBuild(importer?: string | URL): Promise<typeof import('rolldown')> {
  const identity = resolveViteHost(importer)
  const hostRequire = createRequire(identity.packagePath)
  const entry = hostRequire.resolve(identity.kind === 'vite-plus' ? '@voidzero-dev/vite-plus-core/rolldown' : 'rolldown')
  const runtime = await import(pathToFileURL(entry).href) as typeof import('rolldown')
  if (typeof runtime.rolldown !== 'function') {
    throw new TypeError(`[weapp-vite] ${identity.kind}@${identity.packageVersion} 缺少 Rolldown 原生写出能力。`)
  }
  return runtime
}
