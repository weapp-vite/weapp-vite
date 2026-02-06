import type { MpPlatform } from '../types'
import { parse } from 'weapp-ide-cli'
import logger from '../logger'

export async function openIde(platform?: MpPlatform) {
  const argv = ['open', '-p']
  if (platform === 'alipay') {
    argv.push('--platform', platform)
  }

  try {
    await parse(argv)
  }
  catch (error) {
    logger.error(error)
  }
}
