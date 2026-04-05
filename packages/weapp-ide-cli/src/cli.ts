import process from 'node:process'
import { parse } from './cli/index'
import logger from './logger'

const argv = process.argv.slice(2)

// https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
// https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html

try {
  await parse(argv)
}
catch (err) {
  logger.error(err)
  if (typeof (err as { exitCode?: unknown } | null | undefined)?.exitCode === 'number') {
    process.exitCode = (err as { exitCode: number }).exitCode
  }
  else if (typeof (err as { code?: unknown } | null | undefined)?.code === 'number') {
    process.exitCode = (err as { code: number }).code
  }
  else {
    process.exitCode = 1
  }
}
