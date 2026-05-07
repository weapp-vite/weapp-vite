/**
 * @file 百度智能小程序自动化启动适配。
 */
import type { IConnectOptions, ILaunchOptions } from './Launcher'
import type { IExternalAutomatorModule } from './platform'
import { SmartappAutomator as smartappAutomator } from './smartapp'

export const smartappAutomatorRuntime = smartappAutomator

export function toSmartappLaunchOptions(options: ILaunchOptions) {
  const {
    cliPath,
    platform: _platform,
    runtimeProvider: _runtimeProvider,
    ...rest
  } = options
  return {
    deviceType: options.deviceType || 'simulator',
    ...rest,
    ...(cliPath ? { devtoolsPath: cliPath } : {}),
  }
}

export default class SwanLauncher {
  constructor(private readonly automator: IExternalAutomatorModule = smartappAutomator) {}

  async launch(options: ILaunchOptions) {
    return await this.automator.launch(toSmartappLaunchOptions(options))
  }

  async connect(options: IConnectOptions) {
    if (!this.automator.connect) {
      throw new Error('smartapp-automator does not expose connect(). Please use launch() for Baidu smart program automation.')
    }
    return await this.automator.connect({
      ...options,
    })
  }
}
