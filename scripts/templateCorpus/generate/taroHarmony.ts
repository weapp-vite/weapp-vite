import { readFileSync } from 'node:fs'

/** 薄包装作为生成配置参与输入哈希；固定版本漂移时直接拒绝，避免替换冻结工具链。 */
export const taroHarmonyRunner = readFileSync(new URL('./taroHarmony/runner.cjs', import.meta.url), 'utf8')

/** 官方生命周期插件在配置校验后安装本轮 runner，并在平台执行前选定真实构建模式。 */
export const taroHarmonyPlugin = readFileSync(new URL('./taroHarmony/plugin.cjs', import.meta.url), 'utf8')

/** 仅在官方 CLI 子进程内适配冻结包的资源源路径，官方 writer 继续负责复制原始文件。 */
export const taroHarmonyAssets = readFileSync(new URL('./taroHarmony/assets.cjs', import.meta.url), 'utf8')

/** 页面兼容层在模块解析前衔接冻结版协议，源码作为受控配置进入生成身份。 */
export const taroHarmonyPageFiles = Object.fromEntries(['plugin', 'loader', 'source'].map(name => [
  `harmony-jsui-page/${name}.cjs`,
  readFileSync(new URL(`./taroHarmony/page/${name}.cjs`, import.meta.url), 'utf8'),
]))

/** 仅提供官方 JSUI 编译所需的宿主源码配置，不构建或伪造 HAP/ArkTS 产物。 */
export const taroHarmonyHostFiles: Record<string, string> = {
  'harmony-host/entry/src/main/config.json': `${JSON.stringify({
    app: {
      bundleName: 'org.weappvite.templatecorpus',
      vendor: 'template-corpus',
      version: { code: 1, name: '1.0.0' },
    },
    deviceConfig: {},
    module: {
      package: 'org.weappvite.templatecorpus',
      name: '.EntryAbility',
      deviceType: ['phone'],
      js: [{ name: 'default', pages: [], window: { designWidth: 750, autoDesignWidth: false } }],
    },
  }, null, 2)}\n`,
}

/** 官方插件会把输出根改为 projectPath/entry/src/main/js，始终收在当前模式目录。 */
export const taroHarmonyConfig = `harmony: {
    projectPath: require('path').resolve(process.env.CORPUS_OUTPUT, 'harmony-host'),
    hapName: 'entry',
    name: 'default',
    debugReact: true,
    webpackChain(chain) {
      const presetRequire = require('node:module').createRequire(require.resolve('babel-preset-taro/package.json'))
      chain.resolve.alias.set('@babel/runtime', require('path').dirname(presetRequire.resolve('@babel/runtime/package.json')))
    },
  },`

/** 初始配置只包含冻结版 schema 已声明的字段，运行时入口由正式插件生命周期安装。 */
export const taroHarmonyCompiler = `compiler: { type: 'webpack5' },`

/** 在官方编译前准备独立宿主源码；后续路由与 HML 均由官方插件生成。 */
export const taroHarmonyPrepareHost = `process.env.CORPUS_BUILD_MODE = process.argv[2]
const fs = require('fs')
const harmonySeed = path.resolve('harmony-host/entry/src/main/config.json')
const harmonyHostConfig = path.resolve(process.env.CORPUS_OUTPUT, 'harmony-host/entry/src/main/config.json')
fs.mkdirSync(path.dirname(harmonyHostConfig), { recursive: true })
fs.copyFileSync(harmonySeed, harmonyHostConfig)
`

/** 退出码零不足以证明该插件完成编译，核对其官方配置更新确实发生。 */
export const taroHarmonyVerifyHost = `if (result.status === 0) {
  const harmonyConfig = JSON.parse(fs.readFileSync(harmonyHostConfig, 'utf8'))
  const harmonyModule = harmonyConfig && harmonyConfig.module
  const harmonyEntries = harmonyModule && harmonyModule.js
  const harmonyEntry = Array.isArray(harmonyEntries) && harmonyEntries.find(entry => entry && entry.name === 'default')
  if (!harmonyEntry || !Array.isArray(harmonyEntry.pages) || harmonyEntry.pages.length === 0) {
    throw new Error('Official Harmony JSUI compiler did not populate the frozen host route configuration.')
  }
}
`
