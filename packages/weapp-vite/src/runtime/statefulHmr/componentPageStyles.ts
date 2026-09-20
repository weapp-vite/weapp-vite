import type { ComponentStyleOptions } from 'wevu/compiler'
import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import path from 'pathe'

/** 以完整产物中的最终 JSON 覆盖注册选项，只接纳已确认的 Component 页面。 */
export function resolveComponentPageGlobalStyleRoutes(
  output: StatefulHmrOutputFile[],
  pageOptions: ReadonlyMap<string, ComponentStyleOptions>,
): string[] {
  const assets = new Map(output.flatMap(item => item.type === 'asset' ? [[item.fileName, item] as const] : []))
  const appAsset = assets.get('app.json')
  const appConfig: unknown = appAsset ? JSON.parse(Buffer.from(appAsset.source).toString('utf8')) : undefined
  const independentRoots: string[] = []
  if (appConfig && typeof appConfig === 'object' && !Array.isArray(appConfig)) {
    const config = appConfig as Record<string, unknown>
    for (const key of ['subPackages', 'subpackages'] as const) {
      const packages = config[key]
      if (!Array.isArray(packages)) {
        continue
      }
      for (const entry of packages as unknown[]) {
        if (entry && typeof entry === 'object' && 'independent' in entry && entry.independent === true
          && 'root' in entry && typeof entry.root === 'string') {
          independentRoots.push(path.normalize(entry.root).replace(/^\/+|\/+$/g, ''))
        }
      }
    }
  }
  const routes: string[] = []
  for (const [sourceRoute, options] of pageOptions) {
    const route = path.normalize(sourceRoute)
    // 独立分包不继承主包 app.wxss，不能给其页面注入主包全局样式。
    if (independentRoots.some(root => route === root || route.startsWith(`${root}/`))) {
      continue
    }
    const jsonAsset = assets.get(`${route}.json`)
    let isolation: unknown = options.styleIsolation.kind === 'known' ? options.styleIsolation.value : undefined
    if (jsonAsset) {
      // 非法 JSON 属于编译错误，不得回退到 JS options 后继续注入。
      const config: unknown = JSON.parse(Buffer.from(jsonAsset.source).toString('utf8'))
      if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error(`Invalid Component page JSON: ${route}.json`)
      }
      if ('styleIsolation' in config && config.styleIsolation !== undefined) {
        isolation = config.styleIsolation
      }
    }
    if (isolation === 'apply-shared') {
      routes.push(route)
    }
  }
  return routes.sort()
}
