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
  },`

/** 在官方编译前准备独立宿主源码；后续路由与 HML 均由官方插件生成。 */
export const taroHarmonyPrepareHost = `const fs = require('fs')
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
