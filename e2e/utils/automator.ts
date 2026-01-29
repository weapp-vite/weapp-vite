import cmpVersion from 'licia/cmpVersion'
import automator from 'miniprogram-automator'
import MiniProgram from 'miniprogram-automator/out/MiniProgram.js'

const MIN_SDK_VERSION = '2.7.3'
const DEFAULT_LIB_VERSION = '3.13.2'

let versionPatched = false

function patchAutomatorVersionCheck() {
  if (versionPatched) {
    return
  }
  versionPatched = true
  MiniProgram.prototype.checkVersion = async function checkVersionPatched() {
    const info = await this.send('Tool.getInfo')
    const sdkVersion = info?.SDKVersion
    if (!sdkVersion || sdkVersion === 'dev') {
      return
    }
    if (cmpVersion(sdkVersion, MIN_SDK_VERSION) < 0) {
      throw new Error(
        `SDKVersion is currently ${sdkVersion}, while automator requires at least version ${MIN_SDK_VERSION}`,
      )
    }
  }
}

export function launchAutomator(options: Parameters<typeof automator.launch>[0]) {
  patchAutomatorVersionCheck()
  const { projectConfig, timeout, ...rest } = options
  return automator.launch({
    ...rest,
    timeout: timeout ?? 90_000,
    projectConfig: {
      libVersion: DEFAULT_LIB_VERSION,
      ...projectConfig,
    },
  })
}
