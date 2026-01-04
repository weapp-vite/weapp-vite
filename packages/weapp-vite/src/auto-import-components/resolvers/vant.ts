import type { CreateResolver, Options, ResolverObject } from './types'
import { defu } from '@weapp-core/shared'
import components from './json/vant.json'

const defaultPrefix = 'van-'
// 参考：https://vant-ui.github.io/vant-weapp/#/home
export const VantResolver: CreateResolver = (opts) => {
  const { prefix, resolve } = defu<Required<Options>, Options[]>(opts, {
    prefix: defaultPrefix,
    resolve({ name, prefix }) {
      return {
        key: `${prefix}${name}`,
        // 最后 + /index 似乎有问题
        value: `@vant/weapp/${name}`,
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

  const resolver: ResolverObject = {
    components: Object.freeze({ ...map }),
    resolve(componentName) {
      const from = map[componentName]
      if (!from) {
        return
      }
      return { name: componentName, from }
    },
    resolveExternalMetadataCandidates(from) {
      if (!from.startsWith('@vant/weapp/')) {
        return undefined
      }
      const component = from.slice('@vant/weapp/'.length)
      if (!component) {
        return undefined
      }
      return {
        packageName: '@vant/weapp',
        dts: [
          `lib/${component}/index.d.ts`,
          `dist/${component}/index.d.ts`,
        ],
        js: [
          `lib/${component}/index.js`,
          `dist/${component}/index.js`,
        ],
      }
    },
  }
  return resolver
}
