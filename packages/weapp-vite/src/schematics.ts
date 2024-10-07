import type { GenerateType } from '@weapp-core/schematics'
import { generateJs, generateJson, generateWxml, generateWxss } from '@weapp-core/schematics'
import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'

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
}

export async function generate(options: GenerateOptions) {
  const { fileName, outDir, extensions, type } = defu<Required<GenerateOptions>, Partial<GenerateOptions>[]>(options, {
    fileName: 'index',
    type: 'component',
    extensions: {
      js: '.js',
      json: '.json',
      wxml: '.wxml',
      wxss: '.wxss',
    },
  })
  const jsCode = generateJs(type)
  const wxssCode = generateWxss()
  const wxmlCode = generateWxml()
  const jsonCode = JSON.stringify(generateJson(type), undefined, 2)
  await fs.outputFile(path.resolve(outDir, fileName, extensions.js ?? '.js'), jsCode, 'utf8')
  await fs.outputFile(path.resolve(outDir, fileName, extensions.wxss ?? '.wxss'), wxssCode, 'utf8')
  if (type !== 'app') {
    await fs.outputFile(path.resolve(outDir, fileName, extensions.wxml ?? '.wxml'), wxmlCode, 'utf8')
  }
  await fs.outputFile(path.resolve(outDir, fileName, extensions.json ?? '.json'), jsonCode, 'utf8')
}
