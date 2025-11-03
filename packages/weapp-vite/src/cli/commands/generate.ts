import type { GenerateType } from '@weapp-core/schematics'
import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import path from 'pathe'
import logger from '../../logger'
import { generate } from '../../schematics'
import { loadConfig } from '../loadConfig'
import { filterDuplicateOptions, resolveConfigFile } from '../options'

interface GenerateCommandOptions extends GlobalCLIOptions {
  app: boolean
  page: boolean
  name?: string
}

export function registerGenerateCommand(cli: CAC) {
  cli
    .command('g [filepath]', 'generate component')
    .alias('generate')
    .option('-a, --app', 'type app')
    .option('-p, --page', 'type app')
    .option('-n, --name <name>', 'filename')
    .action(async (filepath: string, options: GenerateCommandOptions) => {
      filterDuplicateOptions(options)
      const config = await loadConfig(resolveConfigFile(options))
      let type: GenerateType = 'component'
      let fileName: string | undefined = options.name
      if (options.app) {
        type = 'app'
        if (filepath === undefined) {
          filepath = ''
        }
        fileName = 'app'
      }
      if (filepath === undefined) {
        logger.error('weapp-vite generate <outDir> 命令必须传入路径参数 outDir')
        return
      }
      if (options.page) {
        type = 'page'
      }
      const generateOptions = config?.config.weapp?.generate
      fileName = generateOptions?.filenames?.[type] ?? fileName
      await generate({
        outDir: path.join(generateOptions?.dirs?.[type] ?? '', filepath),
        type,
        fileName,
        extensions: generateOptions?.extensions,
        templates: generateOptions?.templates,
      })
    })
}
