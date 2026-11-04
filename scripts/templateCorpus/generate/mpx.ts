import type { ControlledProject, FrameworkRelease, FrameworkTarget } from './types'

export function createMpxProject(release: FrameworkRelease, target: FrameworkTarget): ControlledProject {
  return {
    dependencies: {
      '@mpxjs/core': release.version === '2.8.64' ? '2.8.62' : release.version,
      '@mpxjs/webpack-plugin': release.version,
      'webpack': release.version === '2.8.64' ? '5.72.0' : '5.102.1',
      'webpack-cli': '5.1.4',
      'vue': '2.7.16',
      ...(release.version === '2.8.64' ? { semver: '7.8.5' } : {}),
    },
    environment: {},
    command: ['node', 'compile.cjs', '{mode}', target.target, '{output}'],
    files: {
      'compile.cjs': `process.env.NODE_ENV = process.argv[2]
const path = require('path')
const webpack = require('webpack')
const MpxWebpackPlugin = require('@mpxjs/webpack-plugin')
const config = {
  mode: process.argv[2],
  devtool: false,
  entry: { app: path.resolve('src/app.mpx') },
  output: { path: path.resolve(process.argv[4]), filename: '[name].js' },
  resolve: { extensions: ['.mpx', '.js', '.json'] },
  module: { rules: [
    { test: /\\.mpx$/, use: MpxWebpackPlugin.loader({}) },
    { test: /\\.(?:wxml|axml|swan|ttml|qml|jxml|ddml|ksml|qxml)$/, use: MpxWebpackPlugin.wxmlLoader() },
    { test: /\\.(?:wxss|acss|css|ttss|qss|jxss)$/, use: MpxWebpackPlugin.wxssLoader() },
    { test: /\\.json$/, type: 'javascript/auto' },
    { test: /\\.(?:wxs|sjs|qs|jds|dds|qjs|ks)$/, use: MpxWebpackPlugin.wxsPreLoader() },
  ] },
  plugins: [new MpxWebpackPlugin({ mode: process.argv[3], srcMode: 'wx' })],
  optimization: { splitChunks: { chunks: 'all', minSize: 0 } },
}
const compiler = webpack(config)
compiler.run((error, stats) => {
  const failed = error || stats.hasErrors()
  if (error) console.error(error)
  if (stats) console.log(stats.toString({ colors: false }))
  compiler.close(closeError => {
    if (closeError) console.error(closeError)
    if (failed || closeError) process.exitCode = 1
  })
})
`,
    },
  }
}
