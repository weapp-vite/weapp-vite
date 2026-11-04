/** Vue2 编译器依赖 CLI 工程提供这些包，官方 npm 包并未完整声明它们。 */
export function uniLegacyDependencies(version: string): Record<string, string> {
  return {
    '@dcloudio/uni-cli-i18n': version,
    '@dcloudio/uni-i18n': version,
    '@dcloudio/uni-mp-weixin': version,
    '@dcloudio/uni-stat': version,
    '@dcloudio/vue-cli-plugin-uni': version,
    // 该插件在入口装配官方 compiler-utils fork，小程序目标也依赖此别名。
    '@dcloudio/vue-cli-plugin-hbuilderx': version,
    '@dcloudio/uni-template-compiler': version,
    '@dcloudio/webpack-uni-mp-loader': version,
    '@dcloudio/webpack-uni-pages-loader': version,
    '@vue/cli-service': '4.5.19',
    '@vue/cli-plugin-babel': '4.5.19',
    '@vue/babel-preset-app': '4.5.19',
    '@babel/core': '7.24.7',
    '@babel/plugin-transform-runtime': '7.24.7',
    '@babel/runtime': '7.24.7',
    'babel-plugin-import': '1.13.8',
    'core-js': '3.37.1',
    'regenerator-runtime': '0.14.1',
    'vue': '2.6.14',
    'vue-template-compiler': '2.6.14',
    'webpack': '4.47.0',
    'copy-webpack-plugin': '5.1.2',
    'postcss': '7.0.39',
    'postcss-comment': '2.0.0',
    'postcss-import': '12.0.1',
    'autoprefixer': '9.8.8',
    'sass-loader': '10.5.2',
    'sass': '1.77.8',
  }
}

/** 配置由受控工程提供，不执行采集仓库里的 Babel/PostCSS 配置。 */
export function uniLegacyConfiguration(): Record<string, string> {
  return {
    'vue.config.js': `module.exports = {
  productionSourceMap: false,
  chainWebpack(config) {
    config.module.rule('vue').use('vue-loader').tap(options => ({ ...options, prettify: false }))
  },
}
`,
    'babel.config.js': `module.exports = {
  presets: [['@vue/app', { modules: 'commonjs', useBuiltIns: 'entry' }]],
  plugins: [
    ['import', {
      libraryName: '@dcloudio/uni-ui',
      customName: name => '@dcloudio/uni-ui/lib/' + name + '/' + name,
    }],
    '@babel/plugin-transform-runtime',
  ],
}
`,
    'postcss.config.js': `const path = require('path')
module.exports = {
  parser: require('postcss-comment'),
  plugins: [
    require('postcss-import')({
      resolve(id) {
        if (id.startsWith('~@/')) return path.resolve(process.env.UNI_INPUT_DIR, id.slice(3))
        if (id.startsWith('@/')) return path.resolve(process.env.UNI_INPUT_DIR, id.slice(2))
        if (id.startsWith('/') && !id.startsWith('//')) return path.resolve(process.env.UNI_INPUT_DIR, id.slice(1))
        return id
      },
    }),
    require('autoprefixer')({ remove: true }),
    require('@dcloudio/vue-cli-plugin-uni/packages/postcss'),
  ],
}
`,
  }
}
