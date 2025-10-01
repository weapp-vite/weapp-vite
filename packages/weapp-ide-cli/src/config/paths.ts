import os from 'node:os'
import path from 'pathe'

const homedir = os.homedir()

export const defaultCustomConfigDirPath = path.join(homedir, '.weapp-ide-cli')

export const defaultCustomConfigFilePath = path.join(
  defaultCustomConfigDirPath,
  'config.json',
)
