import type { App, Component, Page } from '@weapp-core/schematics'
import { get } from '@weapp-core/shared'

export function analyzeAppJson(json: App) {
  const entries: string[] = []
  const pages = json.pages ?? []
  const components = Object.values(json.usingComponents ?? {})
  const subPackages = (
    [...json.subPackages ?? [], ...json.subpackages ?? []]?.reduce<string[]>(
      (acc, cur) => {
        acc.push(...(cur.pages ?? []).map(x => `${cur.root}/${x}`))
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

export function analyzeCommonJson(json: Page | Component) {
  const entries: string[] = []
  const components = Object.values(json.usingComponents ?? {})
  entries.push(...components)
  return entries
}
