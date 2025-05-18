import type { App, Component, Page, Plugin } from '@weapp-core/schematics'
import { get, removeExtensionDeep } from '@weapp-core/shared'

export function analyzeAppJson(json: App) {
  const entries: string[] = []
  const pages = json.pages ?? []
  const components = Object.values(get(json, 'usingComponents') ?? {}) as string[]
  const subPackages = (
    [...json.subPackages ?? [], ...json.subpackages ?? []].filter(x => !x.independent).reduce<string[]>(
      (acc, cur) => {
        // 独立分包不处理，由 subPackages 插件进行处理
        acc.push(...(cur.pages ?? []).map(x => `${cur.root}/${x}`))
        if (cur.entry) {
          acc.push(`${cur.root}/${removeExtensionDeep(cur.entry)}`)
        }
        return acc
      },
      [],
    )) ?? []

  if (get(json, 'tabBar.custom')) {
    entries.push('custom-tab-bar/index')
  }
  // 全局工具栏
  // https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/appbar.html
  if (get(json, 'appBar')) {
    entries.push('app-bar/index')
  }
  entries.push(
    ...pages,
    ...components,
    ...subPackages,
  )
  return entries
}

export function analyzePluginJson(json: Plugin) {
  const entries: string[] = []
  const main = json.main
  const pages = Object.values(get(json, 'pages') ?? {}) as string[]
  const publicComponents = Object.values(get(json, 'publicComponents') ?? {}) as string[]
  entries.push(
    ...pages,
    ...publicComponents,
  )
  main && entries.push(main)
  return entries
}

export function analyzeCommonJson(json: Page | Component) {
  const entries: string[] = []
  const components = Object.values(get(json, 'usingComponents') ?? {}) as string[]
  entries.push(...components)
  return entries
}
