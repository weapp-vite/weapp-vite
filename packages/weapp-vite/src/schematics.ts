import type { GenerateType } from '@weapp-core/schematics'
import process from 'node:process'
import { generateJs, generateJson, generateWxml, generateWxss } from '@weapp-core/schematics'
import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import logger from './logger'

export interface GenerateOptions {
  outDir: string
  fileName?: string
  type?: GenerateType
  extensions?: Partial<{
    js: string
    wxss: string
    wxml: string
    json: string
  }>
  cwd?: string
}

function composePath(outDir: string, filename: string) {
  return `${outDir}${outDir ? '/' : ''}${filename}`
}

const defaultExtensions = {
  js: '.js',
  json: '.json',
  wxml: '.wxml',
  wxss: '.wxss',
}

export async function generate(options: GenerateOptions) {
  let { fileName, outDir, extensions, type, cwd } = defu<Required<GenerateOptions>, Partial<GenerateOptions>[]>(options, {
    // fileName: 'index',
    type: 'component',
    extensions: {
      ...defaultExtensions,
    },
    cwd: process.cwd(),
  })
  if (fileName === undefined) {
    fileName = path.basename(outDir)
  }
  const basepath = path.resolve(cwd, outDir)
  let code: string = generateJs(type)
  let targetFileName = `${fileName}${extensions.js ?? defaultExtensions.js}`

  async function outputFile() {
    await fs.outputFile(path.resolve(basepath, targetFileName), code, 'utf8')
    logger.success(`${composePath(outDir, targetFileName)} 创建成功！`)
  }

  await outputFile()
  targetFileName = `${fileName}${extensions.wxss ?? defaultExtensions.wxss}`
  code = generateWxss()
  await outputFile()
  if (type !== 'app') {
    targetFileName = `${fileName}${extensions.wxml ?? defaultExtensions.wxml}`
    code = generateWxml()
    await outputFile()
  }
  targetFileName = `${fileName}${extensions.json ?? defaultExtensions.json}`
  code = JSON.stringify(generateJson(type), undefined, 2)
  await outputFile()
}
