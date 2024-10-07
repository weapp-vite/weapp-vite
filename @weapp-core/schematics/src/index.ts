import { defu } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'

export interface GenerateOptions {
  outDir: string
  fileName?: string
  type?: 'app' | 'page' | 'component'
  extensions?: Partial<{
    js: string
    wxss: string
    wxml: string
    json: string
  }>
}

export async function generate(options: GenerateOptions) {
  const { fileName, outDir, extensions } = defu<Required<GenerateOptions>, Partial<GenerateOptions>[]>(options, {
    fileName: 'index',
    type: 'component',
    extensions: {
      js: '.js',
      json: '.json',
      wxml: '.wxml',
      wxss: '.wxss',
    },
  })
  await fs.outputFile(path.resolve(outDir, fileName, extensions.js ?? '.js'), '', 'utf8')
  await fs.outputFile(path.resolve(outDir, fileName, extensions.wxss ?? '.wxss'), '', 'utf8')
  await fs.outputFile(path.resolve(outDir, fileName, extensions.wxml ?? '.wxml'), '', 'utf8')
  await fs.outputFile(path.resolve(outDir, fileName, extensions.json ?? '.json'), '', 'utf8')
}
