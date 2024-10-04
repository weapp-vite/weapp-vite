import { UnifiedViteWeappTailwindcssPlugin as uvwt } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
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
  plugins: [
    uvwt({
      rem2rpx: true,
    }),
  ],
  logLevel: 'info',
  envDir: 'envDir',
  // build: {
  //   rollupOptions: {
  //     external: ['lodash'],
  //   },
  // },
})
