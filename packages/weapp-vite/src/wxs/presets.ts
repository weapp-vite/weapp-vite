import { createRequire } from 'node:module'

interface WxsBabelPresets {
  env: typeof import('@babel/preset-env').default
  typescript: typeof import('@babel/preset-typescript').default
}

const nodeRequire = createRequire(import.meta.url)
let presets: WxsBabelPresets | undefined

/** 仅在实际转换 WXS 时同步加载 preset，全部成功后才缓存，保留加载失败的重试能力。 */
export function getWxsBabelPresets(): WxsBabelPresets {
  if (!presets) {
    const env = nodeRequire('@babel/preset-env') as typeof import('@babel/preset-env')
    const typescript = nodeRequire('@babel/preset-typescript') as typeof import('@babel/preset-typescript')
    presets = { env: env.default, typescript: typescript.default }
  }
  return presets
}
