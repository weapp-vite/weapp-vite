import type { SharedUpdateOptions } from './types'
import logger from '@weapp-core/logger'
import path from 'pathe'
import { ctx } from './state'
import {
  getDefaultTsconfigJson,
} from './tsconfigJson'
import { getDefaultTsDts } from './tsDts'
import { writeFile, writeJsonFile } from './utils/fs'
import { resolveOutputPath } from './utils/path'
import { getDefaultViteConfig } from './viteConfig'

export async function initViteConfigFile(options: SharedUpdateOptions) {
  const { root, dest, write = true } = options

  const packageType = ctx.packageJson.value?.type ?? 'module'
  const targetFilename = ctx.viteConfig.name = packageType === 'module' ? 'vite.config.ts' : 'vite.config.mts'
  const viteConfigFilePath = ctx.viteConfig.path = path.resolve(root, targetFilename)
  const outputPath = resolveOutputPath(root, dest, viteConfigFilePath)
  const code = getDefaultViteConfig()
  ctx.viteConfig.value = code

  if (write) {
    await writeFile(outputPath, code)
    logger.log(`✨ 写入 ${path.relative(root, outputPath)} 成功!`)
  }

  return code
}

export async function initTsDtsFile(options: SharedUpdateOptions) {
  const { root, dest, write = true } = options
  const targetFilename = ctx.dts.name = 'vite-env.d.ts'
  const viteDtsFilePath = ctx.dts.path = path.resolve(root, targetFilename)
  const outputPath = resolveOutputPath(root, dest, viteDtsFilePath)
  const code = getDefaultTsDts()
  ctx.dts.value = code

  if (write) {
    await writeFile(outputPath, code)
    logger.log(`✨ 写入 ${path.relative(root, outputPath)} 成功!`)
  }

  return code
}

export async function initTsJsonFiles(options: SharedUpdateOptions) {
  const { root, dest, write = true } = options
  const tsJsonFilename = ctx.tsconfig.name = 'tsconfig.json'
  const tsJsonFilePath = ctx.tsconfig.path = path.resolve(root, tsJsonFilename)
  ctx.tsconfigApp.name = '.weapp-vite/tsconfig.app.json'
  ctx.tsconfigApp.path = path.resolve(root, ctx.tsconfigApp.name)
  ctx.tsconfigNode.name = '.weapp-vite/tsconfig.node.json'
  ctx.tsconfigNode.path = path.resolve(root, ctx.tsconfigNode.name)

  const tsconfig = getDefaultTsconfigJson()

  ctx.tsconfig.value = tsconfig
  ctx.tsconfigApp.value = null
  ctx.tsconfigNode.value = null

  if (write) {
    const tsconfigOutputPath = resolveOutputPath(root, dest, tsJsonFilePath)

    await writeJsonFile(tsconfigOutputPath, tsconfig)
    logger.log(`✨ 写入 ${path.relative(root, tsconfigOutputPath)} 成功!`)
  }

  return {
    tsconfig,
    tsconfigApp: null,
    tsconfigNode: null,
  }
}
