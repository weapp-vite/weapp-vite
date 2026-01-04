import type { CreateResolver, Options, ResolverObject } from './types'
import { defu } from '@weapp-core/shared'
import components from './json/tdesign.json'

const defaultPrefix = 't-'
// 参考：https://tdesign.tencent.com/miniprogram/components/button
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
      if (!from.startsWith('tdesign-miniprogram/')) {
        return undefined
      }

      const relative = from.slice('tdesign-miniprogram/'.length)
      const segments = relative.split('/').filter(Boolean)
      const componentDir = segments[0]
      const fileBase = segments.at(-1)
      if (!componentDir || !fileBase) {
        return undefined
      }

      const baseDir = `miniprogram_dist/${componentDir}`
      const base = `${baseDir}/${fileBase}`
      return {
        packageName: 'tdesign-miniprogram',
        dts: [
          `${baseDir}/type.d.ts`,
          `${baseDir}/props.d.ts`,
          `${base}.d.ts`,
          `${baseDir}/index.d.ts`,
        ],
        js: [
          `${baseDir}/type.js`,
          `${baseDir}/props.js`,
          `${base}.js`,
          `${baseDir}/index.js`,
        ],
      }
    },
  }
  return resolver
}
