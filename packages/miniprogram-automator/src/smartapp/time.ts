/**
 * @file 百度智能小程序自动化时间工具。
 */

export function currentTimestamp() {
  return Date.now()
}

export async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export const time = {
  currentTimestamp,
  delay,
}
