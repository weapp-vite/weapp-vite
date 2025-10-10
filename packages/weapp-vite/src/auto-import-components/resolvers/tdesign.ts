import type { CreateResolver, Options, Resolver } from './types'
import { defu } from '@weapp-core/shared'
import components from './json/tdesign.json'

const defaultPrefix = 't-'
// https://tdesign.tencent.com/miniprogram/components/button
export const TDesignResolver: CreateResolver = (opts) => {
  const { prefix, resolve } = defu<Required<Options>, Options[]>(opts, {
    prefix: defaultPrefix,
    resolve({ name, prefix }) {
      return {
        key: `${prefix}${name}`,
        // 最后 + /index 似乎有问题
        value: `tdesign-miniprogram/${name}/${name}`,
      }
    },
  })

  const map = components.reduce<Record<string, string>>((acc, cur) => {
    const { key, value } = resolve({
      name: cur,
      prefix,
    })
    acc[key] = value
    return acc
  }, {})
  const resolver: Resolver = (componentName) => {
    const from = map[componentName]
    if (from) {
      return {
        name: componentName,
        from,
      }
    }
  }
  resolver.components = Object.freeze({ ...map })
  return resolver
}
