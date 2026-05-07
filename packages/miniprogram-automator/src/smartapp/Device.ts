/**
 * @file 百度智能小程序设备对象。
 */
import type { ScreenshotOptions, SmartappDriver } from './types'
import { Buffer } from 'node:buffer'
import SmartappApp from './App'
import { unsupported } from './errors'

export default class SmartappDevice {
  constructor(
    public type: string,
    public connectType: string,
    public id: string,
    private readonly driver: SmartappDriver = {},
  ) {}

  async source(options: { path?: string } = {}) {
    void options
    if (this.driver.source) {
      return await this.driver.source()
    }
    return ''
  }

  async screenshot(options: ScreenshotOptions = {}) {
    void options
    if (this.driver.screenshot) {
      return await this.driver.screenshot()
    }
    return Buffer.alloc(0)
  }

  async launchSmartapp(_container: string, appKey: string, path = '') {
    const app = await this.newSmartapp(_container, appKey)
    if (path) {
      await app.goto(path)
    }
    return app
  }

  async getScreenSize() {
    return { height: 0, width: 0 }
  }

  async terminateApp() {
    unsupported('device.terminateApp')
  }

  async launchApp() {
    unsupported('device.launchApp')
  }

  async reLaunchApp() {
    unsupported('device.reLaunchApp')
  }

  async install() {
    unsupported('device.install')
  }

  async uninstall() {
    unsupported('device.uninstall')
  }

  async newSmartapp(_container: string, appKey: string) {
    return new SmartappApp(this.driver.miniProgram || null, appKey)
  }

  async tap() {
    unsupported('device.tap')
  }

  async swipe() {
    unsupported('device.swipe')
  }

  async longpress() {
    unsupported('device.longpress')
  }

  async $x() {
    return []
  }

  async home() {
    unsupported('device.home')
  }

  async enter() {
    unsupported('device.enter')
  }

  async back() {
    unsupported('device.back')
  }

  async isInstall() {
    return false
  }

  async close() {
    await this.driver.close?.()
    this.driver.miniProgram?.disconnect()
  }
}
