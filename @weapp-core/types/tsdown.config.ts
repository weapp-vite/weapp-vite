import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    weappIntrinsicElements: './src/weappIntrinsicElements.ts',
    alipayIntrinsicElements: './src/alipayIntrinsicElements.ts',
    ttIntrinsicElements: './src/ttIntrinsicElements.ts',
    miniprogramIntrinsicElements: './src/miniprogramIntrinsicElements.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: true,
  target: 'es2018',
})
