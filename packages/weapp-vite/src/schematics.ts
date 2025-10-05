import type { GenerateType } from '@weapp-core/schematics'
import type {
  GenerateExtensionsOptions,
  GenerateFileType,
  GenerateTemplate,
  GenerateTemplateContext,
  GenerateTemplatesConfig,
} from './types'
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
  extensions?: GenerateExtensionsOptions
  templates?: GenerateTemplatesConfig
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
  let { fileName, outDir, extensions, type, cwd, templates } = defu<Required<GenerateOptions>, Partial<GenerateOptions>[]>(options, {
    type: 'component',
    extensions: {
      ...defaultExtensions,
    },
    cwd: process.cwd(),
    templates: undefined,
  })

  if (fileName === undefined) {
    fileName = path.basename(outDir)
  }

  const basepath = path.resolve(cwd, outDir)
  const targetFileTypes: GenerateFileType[] = type === 'app'
    ? ['js', 'wxss', 'json']
    : ['js', 'wxss', 'json', 'wxml']

  const files: { code?: string, fileName: string }[] = []

  for (const fileType of targetFileTypes) {
    const configuredExt = extensions[fileType] ?? defaultExtensions[fileType]
    let resolvedExt = configuredExt
    let defaultCode: string | undefined

    if (fileType === 'js') {
      defaultCode = generateJs(type)
    }
    else if (fileType === 'wxss') {
      defaultCode = generateWxss()
    }
    else if (fileType === 'wxml') {
      defaultCode = generateWxml(path.join(outDir, fileName))
    }
    else if (fileType === 'json') {
      defaultCode = generateJson(type, configuredExt)
      if (configuredExt === 'js' || configuredExt === 'ts') {
        resolvedExt = `json.${configuredExt}`
      }
    }

    const context: GenerateTemplateContext = {
      type,
      fileType,
      fileName,
      outDir,
      extension: resolvedExt,
      cwd,
      defaultCode,
    }

    const template = resolveTemplate(templates, type, fileType)
    const customCode = await loadTemplate(template, context)
    const finalCode = customCode ?? defaultCode

    if (finalCode !== undefined) {
      files.push({
        fileName: `${fileName}${resolveExtension(resolvedExt)}`,
        code: finalCode,
      })
    }
  }

  for (const { code, fileName } of files) {
    if (code !== undefined) {
      await fs.outputFile(path.resolve(basepath, fileName), code, 'utf8')
      logger.success(`${composePath(outDir, fileName)} 创建成功！`)
    }
  }
}

function resolveTemplate(
  templates: GenerateTemplatesConfig | undefined,
  type: GenerateType,
  fileType: GenerateFileType,
): GenerateTemplate | undefined {
  const scoped = templates?.[type]?.[fileType]
  if (scoped !== undefined) {
    return scoped
  }
  return templates?.shared?.[fileType]
}

async function loadTemplate(
  template: GenerateTemplate | undefined,
  context: GenerateTemplateContext,
): Promise<string | undefined> {
  if (template === undefined) {
    return undefined
  }

  if (typeof template === 'function') {
    const result = await template(context)
    return result == null ? undefined : String(result)
  }

  if (typeof template === 'string') {
    return readTemplateFile(template, context)
  }

  if ('content' in template && typeof template.content === 'string') {
    return template.content
  }

  if ('path' in template && typeof template.path === 'string') {
    return readTemplateFile(template.path, context)
  }

  return undefined
}

async function readTemplateFile(templatePath: string, context: GenerateTemplateContext) {
  const absolutePath = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(context.cwd, templatePath)
  return fs.readFile(absolutePath, 'utf8')
}
