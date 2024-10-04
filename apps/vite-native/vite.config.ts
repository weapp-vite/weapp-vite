import type { UserConfig } from 'weapp-vite/config'
import process from 'node:process'
import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'

export default <UserConfig>{
  // root: './packageA',
  // build: {
  //   outDir: 'dist/packageA',
  // },
  // weapp: {
  //   srcRoot: 'packageA',
  //   subPackage: {

  //   },
  //   // srcRoot: 'src',
  // },
  // mode: '',
  // mode: 'x',
  // mode: 'xx',
  plugins: process.env.__TEST__
    ? []
    : [
        uvwt({
          rem2rpx: true,
        }),
      ],
  // logLevel: 'info',
  envDir: 'envDir',
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  // build: {
  //   rollupOptions: {
  //     external: ['lodash'],
  //   },
  // },
}
