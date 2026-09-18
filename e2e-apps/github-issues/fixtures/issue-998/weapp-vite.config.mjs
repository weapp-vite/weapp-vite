import path from 'node:path'

export default {
  build: { minify: true, cssMinify: true },
  weapp: {
    srcRoot: 'src',
    hmr: { runtime: 'stateful-experimental' },
    wevu: { defaults: { component: { options: { virtualHost: true, styleIsolation: 'apply-shared' } } } },
    autoRoutes: { include: ['pages/**'] },
    styles: [{ source: 'app.css', include: 'app.vue' }],
    tailwindcss: {
      cssEntries: [path.resolve(import.meta.dirname, 'src/app.css')],
      cssOptions: { cssPreflight: false, rem2rpx: true },
    },
  },
}
