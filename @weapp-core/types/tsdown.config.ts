import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'weappIntrinsicElements': './src/weappIntrinsicElements.ts',
    'alipayIntrinsicElements': './src/alipayIntrinsicElements.ts',
    'ttIntrinsicElements': './src/ttIntrinsicElements.ts',
    'miniprogramIntrinsicElements': './src/miniprogramIntrinsicElements.ts',
    'wechat-api': './src/wechat-api.ts',
    'alipay-api': './src/alipay-api.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: true,
  target: 'es2018',
})
