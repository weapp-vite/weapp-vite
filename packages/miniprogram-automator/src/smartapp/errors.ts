/**
 * @file 百度智能小程序自动化错误定义。
 */

export class SmartappUnsupportedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available in the lightweight TypeScript smartapp runtime.`)
    this.name = 'SmartappUnsupportedError'
  }
}

export function unsupported(feature: string): never {
  throw new SmartappUnsupportedError(feature)
}
