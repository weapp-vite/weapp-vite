import { parse } from 'weapp-ide-cli'
import logger from '../logger'

export async function openIde() {
  try {
    await parse(['open', '-p'])
  }
  catch (error) {
    logger.error(error)
  }
}
