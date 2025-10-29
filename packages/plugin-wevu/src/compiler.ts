import type { File as BabelFile } from '@babel/types'
import type { SFCBlock, SFCStyleBlock } from 'vue/compiler-sfc'
import { createHash } from 'node:crypto'
import { parse as babelParse } from '@babel/parser'
import traverse from '@babel/traverse'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import { recursive as mergeRecursive } from 'merge'
import { compileScript, parse } from 'vue/compiler-sfc'

const IMPORT_STATEMENT = 'import { createWevuComponent } from \'@weapp-vite/plugin-wevu/runtime\'\n\n'
const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'

export interface WevuCompileOptions {
  filename: string
  source?: string
}

export interface WevuCompiledBlock {
  code: string
  lang?: string
}

export interface WevuCompileResult {
  script?: WevuCompiledBlock
  template?: WevuCompiledBlock
  style?: WevuCompiledBlock
  config?: WevuCompiledBlock
}

interface TransformResult {
  code: string
  transformed: boolean
}

function transformScript(source: string): TransformResult {
  const ast: BabelFile = babelParse(source, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'jsx',
    ],
  })

  const s = new MagicString(source)
  let replaced = false

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (replaced) {
        return
      }
      const node = path.node
      if (!node.declaration) {
        return
      }
      const declarationCode = source.slice(node.declaration.start ?? node.start ?? 0, node.declaration.end ?? node.end ?? 0)
      s.overwrite(node.start ?? 0, node.end ?? 0, `const ${DEFAULT_OPTIONS_IDENTIFIER} = ${declarationCode};`)
      replaced = true
      path.stop()
    },
  })

  if (!replaced) {
    return {
      code: source,
      transformed: false,
    }
  }

  if (!source.includes('@weapp-vite/plugin-wevu/runtime')) {
    s.prepend(IMPORT_STATEMENT)
  }

  if (!source.endsWith('\n')) {
    s.append('\n')
  }
  s.append(`\ncreateWevuComponent(${DEFAULT_OPTIONS_IDENTIFIER});\n`)

  return {
    code: s.toString(),
    transformed: true,
  }
}

function normalizeScriptLang(lang?: string) {
  if (!lang) {
    return 'js'
  }
  if (lang === 'tsx' || lang === 'ts') {
    return 'ts'
  }
  return 'js'
}

function normalizeStyleLang(style: SFCStyleBlock) {
  const lang = style.lang ?? 'wxss'
  if (lang === 'css') {
    return 'wxss'
  }
  return lang
}

function hashId(input: string) {
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}

function compileScriptBlock(descriptor: ReturnType<typeof parse>['descriptor'], filename: string): WevuCompiledBlock | undefined {
  let scriptContent = ''
  let scriptLang = descriptor.script?.lang ?? 'js'

  if (descriptor.scriptSetup) {
    const compiled = compileScript(descriptor, {
      id: hashId(filename),
    })
    scriptContent = compiled.content
    scriptLang = compiled.lang ?? scriptLang
  }
  else if (descriptor.script) {
    scriptContent = descriptor.script.content
    scriptLang = descriptor.script.lang ?? scriptLang
  }

  scriptContent = scriptContent.replace(/^\s*\n/, '')

  if (!scriptContent.trim()) {
    return undefined
  }

  const transformed = transformScript(scriptContent)
  const lang = normalizeScriptLang(scriptLang)
  return {
    code: transformed.code,
    lang,
  }
}

function compileStyleBlocks(styles: SFCStyleBlock[]): WevuCompiledBlock | undefined {
  if (!styles.length) {
    return undefined
  }

  const lang = normalizeStyleLang(styles[0])
  const code = styles
    .map(style => style.content.trim())
    .filter(Boolean)
    .join('\n\n')

  return {
    code,
    lang,
  }
}

function compileConfigBlocks(blocks: SFCBlock[]): WevuCompiledBlock | undefined {
  const configBlocks = blocks.filter(block => block.type === 'config')
  if (!configBlocks.length) {
    return undefined
  }

  const accumulator: Record<string, any> = {}
  for (const block of configBlocks) {
    const parsed = parseJson(block.content, undefined, true)
    mergeRecursive(accumulator, parsed)
  }

  return {
    code: JSON.stringify(accumulator, null, 2),
    lang: 'json',
  }
}

export async function compileWevuSfc(options: WevuCompileOptions): Promise<WevuCompileResult> {
  const { filename } = options
  const source = options.source ?? await fs.readFile(filename, 'utf8')
  const parsed = parse(source, { filename })
  if (parsed.errors.length) {
    const [firstError] = parsed.errors
    const message = typeof firstError === 'string' ? firstError : firstError.message
    throw new Error(`Failed to parse ${filename}: ${message}`)
  }

  const { descriptor } = parsed
  const scriptResult = compileScriptBlock(descriptor, filename)
  const templateResult = descriptor.template
    ? { code: descriptor.template.content.trim(), lang: descriptor.template.lang }
    : undefined
  const styleResult = compileStyleBlocks(descriptor.styles)
  const configResult = compileConfigBlocks(descriptor.customBlocks)

  return {
    script: scriptResult,
    template: templateResult,
    style: styleResult,
    config: configResult,
  }
}
