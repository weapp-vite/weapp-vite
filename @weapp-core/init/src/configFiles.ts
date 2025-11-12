import type { SharedUpdateOptions } from './types'
import logger from '@weapp-core/logger'
import path from 'pathe'
import { ctx } from './state'
import {
  getDefaultTsconfigAppJson,
  getDefaultTsconfigJson,
  getDefaultTsconfigNodeJson,
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
  const tsAppJsonFilename = ctx.tsconfigApp.name = 'tsconfig.app.json'
  const tsAppJsonFilePath = ctx.tsconfigApp.path = path.resolve(root, tsAppJsonFilename)
  const tsNodeJsonFilename = ctx.tsconfigNode.name = 'tsconfig.node.json'
  const tsNodeJsonFilePath = ctx.tsconfigNode.path = path.resolve(root, tsNodeJsonFilename)

  const tsconfig = getDefaultTsconfigJson()
  const tsconfigApp = getDefaultTsconfigAppJson()
  const includeFiles = ctx.viteConfig.name ? [ctx.viteConfig.name] : []
  const tsconfigNode = getDefaultTsconfigNodeJson(includeFiles)

  ctx.tsconfig.value = tsconfig
  ctx.tsconfigApp.value = tsconfigApp
  ctx.tsconfigNode.value = tsconfigNode

  if (write) {
    const tsconfigOutputPath = resolveOutputPath(root, dest, tsJsonFilePath)
    const tsconfigAppOutputPath = resolveOutputPath(root, dest, tsAppJsonFilePath)
    const tsconfigNodeOutputPath = resolveOutputPath(root, dest, tsNodeJsonFilePath)

    await writeJsonFile(tsconfigOutputPath, tsconfig)
    await writeJsonFile(tsconfigAppOutputPath, tsconfigApp)
    await writeJsonFile(tsconfigNodeOutputPath, tsconfigNode)
    logger.log(
      `✨ 写入 ${[
        path.relative(root, tsconfigOutputPath),
        path.relative(root, tsconfigAppOutputPath),
        path.relative(root, tsconfigNodeOutputPath),
      ].join(', ')} 成功!`,
    )
  }

  return {
    tsconfig,
    tsconfigApp,
    tsconfigNode,
  }
}
