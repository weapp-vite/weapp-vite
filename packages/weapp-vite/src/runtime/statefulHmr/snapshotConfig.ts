import type { InlineConfig } from 'vite'
import type { ConfigService } from '../config/types'
import { readFile, stat } from 'node:fs/promises'
import { parse as parseJson } from 'comment-json'
import path from 'pathe'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createSnapshotTransformPlugin } from './snapshotTransform'

async function dependsOnMissingManagedTsconfig(config: ConfigService, tsconfig: string) {
  const managed = new Set(['app', 'shared', 'node', 'server'].map(name => normalizeFsResolvedId(path.join(config.cwd, `.weapp-vite/tsconfig.${name}.json`))))
  const missingManaged = async (file: string) => {
    if (!managed.has(normalizeFsResolvedId(file))) {
      return false
    }
    try {
      await stat(file)
      return false
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return true
      }
      throw error
    }
  }
  if (await missingManaged(tsconfig)) {
    return true
  }
  if (normalizeFsResolvedId(tsconfig) !== normalizeFsResolvedId(path.join(config.cwd, 'tsconfig.json'))) {
    return false
  }
  try {
    const parsed: unknown = parseJson(await readFile(tsconfig, 'utf8'), undefined, true)
    const extensions = parsed && typeof parsed === 'object' && 'extends' in parsed ? parsed.extends : undefined
    const files = (Array.isArray(extensions) ? extensions : [extensions]).filter((file): file is string => typeof file === 'string')
    return files.length === 1 && await missingManaged(path.resolve(path.dirname(tsconfig), files[0]!))
  }
  catch {
    // 用户配置的读取或语法错误仍由原生构建路径诊断。
    return false
  }
}

/** 预检不生成支持文件；缺失的受管默认配置由已解析的别名和转换选项接管。 */
export async function prepareSnapshotTsconfig(config: ConfigService, options: InlineConfig) {
  const rolldownOptions = options.build?.rolldownOptions
  const configuredOptions = [config.options.sourceConfig, config.loadOptions.inlineConfig]
    .map(source => source?.build?.rolldownOptions)
  if (configuredOptions.some(source => source && (Object.prototype.hasOwnProperty.call(source, 'tsconfig') || source.resolve?.tsconfigFilename))
    || options.tsconfig
    || typeof rolldownOptions?.tsconfig !== 'string'
    || !await dependsOnMissingManagedTsconfig(config, rolldownOptions.tsconfig)) {
    return
  }
  options.build!.rolldownOptions = { ...rolldownOptions, tsconfig: false }
  if (options.oxc !== false) {
    options.plugins = [createSnapshotTransformPlugin(options.oxc ?? {}), ...(options.plugins ?? [])]
    // 原生 vite-transform 的 tsconfig 仅支持路径，无法关闭发现；不让它再次处理已转换源码。
    options.oxc = false
    options.esbuild = false
  }
}
