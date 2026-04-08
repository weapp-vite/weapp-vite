import type { CreateResolver, Options, ResolverObject } from './types'
import { defu } from '@weapp-core/shared'
import components from './json/weui.json'

const defaultPrefix = 'mp-'
// 参考：https://github.com/wechat-miniprogram/weui-miniprogram/tree/master/src/components
export const WeuiResolver: CreateResolver = (opts) => {
  const { prefix, resolve, supportFilesStrategy } = defu<Required<Options>, Options[]>(opts, {
    prefix: defaultPrefix,
    supportFilesStrategy: 'full',
    resolve({ name, prefix }) {
      return {
        key: `${prefix}${name}`,
        value: `weui-miniprogram/${name}/${name}`,
      }
    },
  })

  const map = (components as string[]).reduce<Record<string, string>>((acc, cur) => {
    const { key, value } = resolve({
      name: cur,
      prefix,
    })
    acc[key] = value
    return acc
  }, {})

  const resolver: ResolverObject = {
    components: Object.freeze({ ...map }),
    componentLookupStrategy: 'static',
    supportFilesStrategy,
    resolve(componentName) {
      const from = map[componentName]
      if (!from) {
        return
      }
      return { name: componentName, from }
    },
  }
  return resolver
}
