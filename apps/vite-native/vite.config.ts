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
  plugins: [
    uvwt({
      rem2rpx: true,
    }),
  ],
  logLevel: 'info',
  // build: {
  //   rollupOptions: {
  //     external: ['lodash'],
  //   },
  // },
})
