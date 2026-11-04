/** 固定 Taro 2 官方模板的 Babel 6 配置，不套用 Taro 3 才发布的 preset。 */
export function taroLegacyDependencies(version: string, target: string): Record<string, string> {
  return {
    '@tarojs/mini-runner': version,
    [`@tarojs/taro-${target}`]: version,
    '@tarojs/plugin-terser': version,
    'babel-core': '6.26.3',
    'babel-runtime': '6.26.0',
    'babel-preset-env': '1.7.0',
    'babel-plugin-transform-decorators-legacy': '1.3.5',
    'babel-plugin-transform-class-properties': '6.24.1',
    'babel-plugin-transform-object-rest-spread': '6.26.0',
    'babel-plugin-transform-runtime': '6.23.0',
    'nervjs': '1.5.7',
    ...(target === 'quickapp'
      ? {
          '@tarojs/helper': version,
          '@tarojs/service': version,
          '@tarojs/components-qa': version,
        }
      : {}),
  }
}

export const taroLegacyBabel = `babel: {
    sourceMap: true,
    presets: [['env', { modules: false }]],
    plugins: ['transform-decorators-legacy', 'transform-class-properties', 'transform-object-rest-spread',
      ['transform-runtime', { helpers: false, polyfill: false, regenerator: true, moduleName: 'babel-runtime' }]],
  },`

/** 通过官方 Webpack 链配置避免 UX 脚本中的开发模块标识带入本机路径。 */
export const taroQuickappWebpack = `webpackChain(chain) {
      chain.devtool(false)
      chain.output.pathinfo(false)
      chain.optimization.set('namedModules', false).set('moduleIds', 'hashed')
    },`

/** 只构建官方 UX 源产物；宿主容器打包会下载未固定的 latest，不属于模板生成。 */
export const taroQuickappCompile = `process.env.NODE_ENV = process.argv[2]
process.env.TARO_ENV = 'quickapp'
process.env.CORPUS_OUTPUT = process.argv[4]
const path = require('path')
const fs = require('fs')
const Config = require('@tarojs/service/dist/Config').default
const project = new Config({ appPath: process.cwd() })
if (!project.isInitSuccess) throw new Error('Official Taro 2 project configuration could not be initialized.')
const config = project.getConfigWithNamed('quickapp', 'mini')
const { recursiveReplaceObjectKeys } = require('@tarojs/cli/dist/util')
const loaded = require('@tarojs/mini-runner')
const runner = loaded.default || loaded
const manifestPath = path.resolve('project.quickapp.json')
const quickappJSON = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : require('@tarojs/cli/dist/config/manifest.default.json')
const originalModify = config.modifyBuildTempFileContent
const replaceKeyMap = {
  navigationBarTitleText: 'titleBarText',
  navigationBarBackgroundColor: 'titleBarBackgroundColor',
  navigationBarTextStyle: 'titleBarTextColor',
  pageOrientation: 'orientation',
  backgroundTextStyle: false,
  onReachBottomDistance: false,
  backgroundColorBottom: false,
  backgroundColorTop: false,
}
runner(process.cwd(), { ...config,
  outputRoot: path.join(config.outputRoot, 'src'),
  mode: process.argv[2], isWatch: false,
  nodeModulesPath: path.resolve('node_modules'), buildAdapter: 'quickapp',
  isBuildPlugin: false, globalObject: 'global',
  fileType: { templ: '.ux', style: '.css', config: '.json', script: '.js' },
  isUseComponentBuildPage: false, quickappJSON, isBuildQuickapp: true,
  async modifyBuildTempFileContent(tempFiles) {
    if (typeof originalModify === 'function') await originalModify(tempFiles)
    for (const item of Object.values(tempFiles)) {
      if (item.config) recursiveReplaceObjectKeys(item.config, replaceKeyMap)
    }
  },
  onBuildFinish({ error, stats }) {
    if (error || stats && stats.hasErrors()) process.exitCode = 1
  },
}).catch(error => { console.error(error); process.exitCode = 1 })
`
