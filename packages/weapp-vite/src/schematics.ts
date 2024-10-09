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
  js: 'js',
  json: 'json',
  wxml: 'wxml',
  wxss: 'wxss',
}

function resolveExtension(extension: string) {
  return extension ? (extension.startsWith('.') ? extension : `.${extension}`) : ''
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
  const targetFileTypes = ['js', 'wxss', 'json']
  if (type !== 'app') {
    targetFileTypes.push('wxml')
  }
  const files: { code?: string, fileName: string }[] = (
    targetFileTypes as [
      'js',
      'wxss',
      'json',
      'wxml',
    ])
    .map((x) => {
      let code: string | undefined
      if (x === 'js') {
        code = generateJs(type)
      }
      else if (x === 'wxss') {
        code = generateWxss()
      }
      else if (x === 'wxml') {
        code = generateWxml()
      }
      else if (x === 'json') {
        code = JSON.stringify(generateJson(type), undefined, 2)
      }
      return {
        fileName: `${fileName}${resolveExtension(extensions[x] ?? defaultExtensions[x])}`,
        code,
      }
    })

  for (const { code, fileName } of files) {
    if (code !== undefined) {
      await fs.outputFile(path.resolve(basepath, fileName), code, 'utf8')
      logger.success(`${composePath(outDir, fileName)} 创建成功！`)
    }
  }
}
