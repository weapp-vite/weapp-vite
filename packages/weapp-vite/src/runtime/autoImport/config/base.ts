import type { MutableCompilerContext } from '../../../context'
import path from 'pathe'

export const DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME = 'auto-import-components.json'

export function resolveBaseDir(configService: NonNullable<MutableCompilerContext['configService']>) {
  const configFilePath = configService.configFilePath
  if (configFilePath) {
    return path.dirname(configFilePath)
  }
  return configService.cwd
}

export function resolveTypedComponentsDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
  return path.resolve(resolveBaseDir(configService), 'typed-components.d.ts')
}

export function resolveHtmlCustomDataDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
  return path.resolve(resolveBaseDir(configService), 'mini-program.html-data.json')
}

export function resolveVueComponentsDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
  return path.resolve(resolveBaseDir(configService), 'components.d.ts')
}
