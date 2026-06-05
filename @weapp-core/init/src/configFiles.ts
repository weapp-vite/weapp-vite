import type { SharedUpdateOptions } from './types'
import logger from '@weapp-core/logger'
import path from 'pathe'
import { ctx } from './state'
import {
  getDefaultTsconfigAppJson,
  getDefaultTsconfigJson,
  getDefaultTsconfigNodeJson,
  getDefaultTsconfigServerJson,
  getDefaultTsconfigSharedJson,
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
  const code = getDefaultViteConfig({
    srcRoot: ctx.projectLayout.srcRoot,
  })
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
  ctx.tsconfigServer.name = '.weapp-vite/tsconfig.server.json'
  ctx.tsconfigServer.path = path.resolve(root, ctx.tsconfigServer.name)
  ctx.tsconfigNode.name = '.weapp-vite/tsconfig.node.json'
  ctx.tsconfigNode.path = path.resolve(root, ctx.tsconfigNode.name)

  const tsconfig = getDefaultTsconfigJson()
  const tsconfigSharedName = '.weapp-vite/tsconfig.shared.json'
  const tsconfigSharedEmptyName = '.weapp-vite/tsconfig.shared.empty.d.ts'
  const tsconfigSharedPath = path.resolve(root, tsconfigSharedName)
  const tsconfigSharedEmptyPath = path.resolve(root, tsconfigSharedEmptyName)

  const tsconfigApp = getDefaultTsconfigAppJson({
    srcRoot: ctx.projectLayout.srcRoot,
  })
  const tsconfigNode = getDefaultTsconfigNodeJson()
  const tsconfigServer = getDefaultTsconfigServerJson()
  const tsconfigShared = getDefaultTsconfigSharedJson()

  ctx.tsconfig.value = tsconfig
  ctx.tsconfigApp.value = tsconfigApp
  ctx.tsconfigServer.value = tsconfigServer
  ctx.tsconfigNode.value = tsconfigNode

  if (write) {
    const tsconfigOutputPath = resolveOutputPath(root, dest, tsJsonFilePath)

    await writeJsonFile(tsconfigOutputPath, tsconfig)
    logger.log(`✨ 写入 ${path.relative(root, tsconfigOutputPath)} 成功!`)
    const managedFiles = [
      {
        filePath: ctx.tsconfigApp.path,
        value: tsconfigApp,
      },
      {
        filePath: ctx.tsconfigNode.path,
        value: tsconfigNode,
      },
      {
        filePath: ctx.tsconfigServer.path,
        value: tsconfigServer,
      },
      {
        filePath: tsconfigSharedPath,
        value: tsconfigShared,
      },
    ]
    for (const file of managedFiles) {
      const outputPath = resolveOutputPath(root, dest, file.filePath)
      await writeJsonFile(outputPath, file.value)
      logger.log(`✨ 写入 ${path.relative(root, outputPath)} 成功!`)
    }
    const sharedEmptyOutputPath = resolveOutputPath(root, dest, tsconfigSharedEmptyPath)
    await writeFile(sharedEmptyOutputPath, 'export {}\n')
    logger.log(`✨ 写入 ${path.relative(root, sharedEmptyOutputPath)} 成功!`)
  }

  return {
    tsconfig,
    tsconfigApp,
    tsconfigServer,
    tsconfigNode,
  }
}
