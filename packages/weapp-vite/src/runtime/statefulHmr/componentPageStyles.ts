import type { ComponentStyleOptions } from 'wevu/compiler'
import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import path from 'pathe'
import { parseJsLike, traverse } from '../../utils/babel'

function hasNativePageRegistration(code: string) {
  if (!code.includes('Page')) {
    return false
  }
  let found = false
  traverse(parseJsLike(code), {
    CallExpression(callPath) {
      const callee = callPath.node.callee
      if (callee.type === 'Identifier' && callee.name === 'Page' && !callPath.scope.hasBinding('Page')) {
        found = true
        callPath.stop()
      }
    },
  })
  return found
}

/** 以最终 JSON 和注册方式确认继承全局样式的页面，保留独立分包与隔离边界。 */
export function resolveComponentPageGlobalStyleRoutes(
  output: StatefulHmrOutputFile[],
  pageOptions: ReadonlyMap<string, ComponentStyleOptions>,
): string[] {
  const assets = new Map(output.flatMap(item => item.type === 'asset' ? [[item.fileName, item] as const] : []))
  const appAsset = assets.get('app.json')
  const appConfig: unknown = appAsset ? JSON.parse(Buffer.from(appAsset.source).toString('utf8')) : undefined
  const independentRoots: string[] = []
  const nativeCandidates: string[] = []
  if (appConfig && typeof appConfig === 'object' && !Array.isArray(appConfig)) {
    const config = appConfig as Record<string, unknown>
    if (Array.isArray(config.pages)) {
      nativeCandidates.push(...config.pages.filter((route): route is string => typeof route === 'string'))
    }
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
        else if (entry && typeof entry === 'object' && 'root' in entry && typeof entry.root === 'string'
          && 'pages' in entry && Array.isArray(entry.pages)) {
          nativeCandidates.push(...entry.pages.filter((route): route is string => typeof route === 'string')
            .map(route => path.join(entry.root as string, route)))
        }
      }
    }
  }
  const routes: string[] = []
  const componentRoutes = new Set(Array.from(pageOptions.keys(), route => path.normalize(route)))
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
  const chunks = new Map(output.flatMap(item => item.type === 'chunk' ? [[item.fileName, item] as const] : []))
  for (const sourceRoute of nativeCandidates) {
    const route = path.normalize(sourceRoute)
    if (componentRoutes.has(route) || independentRoots.some(root => route === root || route.startsWith(`${root}/`))) {
      continue
    }
    const chunk = chunks.get(`${route}.js`)
    if (!chunk || !hasNativePageRegistration(chunk.code)) {
      continue
    }
    const json = assets.get(`${route}.json`)
    const config: unknown = json ? JSON.parse(Buffer.from(json.source).toString('utf8')) : {}
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error(`Invalid native page JSON: ${route}.json`)
    }
    if ('component' in config && config.component === true) {
      continue
    }
    // 普通 Page 不采用 Component 专用的 styleIsolation 选项。
    routes.push(route)
  }
  return [...new Set(routes)].sort()
}
