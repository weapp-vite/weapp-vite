export default {
  build: { minify: false, cssMinify: false, sourcemap: false },
  weapp: {
    srcRoot: 'src',
    autoRoutes: false,
    hmr: { runtime: 'stateful-experimental' },
    tailwindcss: {
      cssEntries: ['src/app.css'],
      cssOptions: { cssPreflight: false, rem2rpx: true },
    },
  },
}
