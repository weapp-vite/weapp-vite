import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const outputDirectory = path.resolve(import.meta.dirname, '../.generated/platform-types')
const referencePattern = /^\s*\/\/\/\s*<reference\s+(path|types|lib)=["']([^"']+)["']\s*\/>\s*$/gm

/** 将官方声明图收敛为外部模块，保留签名和许可证，避免注入宿主全局。 */
async function scopedDeclarations(entry, exported, packageRoot) {
  const visited = new Set()
  const declarations = []
  const libraries = new Set()
  async function visit(filename) {
    filename = await fs.realpath(filename)
    if (visited.has(filename)) {
      return
    }
    const relative = path.relative(packageRoot, filename)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Platform declaration reference escaped its package')
    }
    visited.add(filename)
    const source = await fs.readFile(filename, 'utf8')
    if (/\bdeclare\s+global\s*\{/u.test(source)) {
      throw new Error(`Platform declaration requires an explicit global adaptation: ${relative}`)
    }
    for (const [, kind, specifier] of source.matchAll(referencePattern)) {
      if (kind === 'path') {
        await visit(path.resolve(path.dirname(filename), specifier))
      }
      else if (kind === 'types') {
        throw new Error(`Unexpected ambient dependency in platform declarations: ${specifier}`)
      }
      else {
        libraries.add(specifier)
      }
    }
    declarations.push(source.replace(referencePattern, ''))
  }
  await visit(entry)
  const references = [...libraries].map(name => `/// <reference lib=${JSON.stringify(name)} />`).join('\n')
  return { source: `${references}\n${declarations.join('\n')}`, exported }
}

/** 将官方 ambient external modules 转为私有相对模块，保持所有原有成员导出。 */
async function writeWechatModules(source, exported) {
  const file = ts.createSourceFile('wechat.d.ts', source, ts.ScriptTarget.Latest, true)
  const modules = file.statements.filter(node => ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name))
  const names = new Map(modules.map(node => [node.name.text, `xr-${createHash('sha256').update(node.name.text).digest('hex')}`]))
  const license = source.match(/\/\*![\s\S]*?\*\//u)?.[0] ?? ''
  const environment = ['phys3D', 'HTMLCanvasElement', 'ImageData', 'HTMLImageElement']
  const edits = modules.map(node => ({ start: node.pos, end: node.end, text: '' }))
  for (const node of modules) {
    if (!node.body || !ts.isModuleBlock(node.body)) {
      throw new Error('Unexpected nested platform ambient module')
    }
    const body = node.body.statements.map((statement) => {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : []
      const alreadyExported = modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      const declaration = ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)
        || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        || ts.isEnumDeclaration(statement) || ts.isVariableStatement(statement) || ts.isModuleDeclaration(statement)
      const prefix = declaration && !alreadyExported && !ts.isImportEqualsDeclaration(statement) ? 'export ' : ''
      const leading = source.slice(statement.pos, statement.getStart(file))
      return `${leading}${prefix}${statement.getText(file)}`
    }).join('\n')
    const imports = `import type { ${environment.join(', ')} } from './wechat.js'\n`
    await writeInput(names.get(node.name.text), `${license}\n${imports}${rewriteModuleReferences(body, names)}\n`)
  }
  let scoped = source
  for (const edit of edits.reverse()) {
    scoped = scoped.slice(0, edit.start) + edit.text + scoped.slice(edit.end)
  }
  await writeInput('wechat', `${preserveNativeIdentifiers(rewriteModuleReferences(scoped, names))}\nexport { ${[exported, ...environment].join(', ')} }\n`)
}

/** 官方声明已存在时复用原始类型品牌，未加载时保留模块内的原始类。 */
function preserveNativeIdentifiers(source) {
  const file = ts.createSourceFile('wechat.d.ts', source, ts.ScriptTarget.Latest, true)
  const edits = []
  const probes = []
  let constructors = 0
  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'Constructor') {
      const parent = node.parent.parent
      if (ts.isModuleDeclaration(parent) && ts.isModuleDeclaration(parent.parent)
        && parent.parent.name.getText(file) === 'WechatMiniprogram'
        && ['Component', 'Behavior'].includes(parent.name.getText(file))) {
        const name = parent.name.getText(file)
        edits.push({ start: node.name.getStart(file), end: node.name.end, text: 'ScopedConstructor' })
        edits.push({ start: node.end, end: node.end, text: `\n    type Constructor = globalThis.WechatMiniprogram.${name}.Constructor extends (...args: any[]) => any\n      ? globalThis.WechatMiniprogram.${name}.Constructor\n      : ScopedConstructor\n` })
        constructors += 1
      }
    }
    if (ts.isClassDeclaration(node) && node.name?.text === 'TypeSignature') {
      const parent = node.parent.parent
      if (!ts.isModuleDeclaration(parent) || !ts.isModuleDeclaration(parent.parent)
        || parent.parent.name.getText(file) !== 'WechatMiniprogram'
        || !['Component', 'Behavior'].includes(parent.name.getText(file))) {
        return
      }
      const name = parent.name.getText(file)
      const parameters = node.typeParameters.map(parameter => parameter.getText(file)).join(', ')
      const argumentsText = node.typeParameters.map(parameter => parameter.name.text).join(', ')
      edits.push({ start: node.name.getStart(file), end: node.name.end, text: 'ScopedTypeSignature' })
      edits.push({ start: node.end, end: node.end, text: `\n    type TypeSignature<${parameters}> = globalThis.WechatMiniprogram.${name}.Constructor extends (...args: any[]) => any\n      ? globalThis.WechatMiniprogram.${name}.TypeSignature<${argumentsText}>\n      : ScopedTypeSignature<${argumentsText}>\n` })
      probes.push(`namespace ${name} { interface Constructor {} interface TypeSignature<${argumentsText}> {} }`)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (probes.length !== 2 || constructors !== 2) {
    throw new Error(`Official component/behavior declarations changed: ${probes.length} brands, ${constructors} constructors`)
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
  }
  return `${source}\ndeclare global { namespace WechatMiniprogram { ${probes.join('\n')} } }\n`
}

/** 只重写声明 AST 中指向原 ambient module 的字符串引用。 */
function rewriteModuleReferences(source, names) {
  const file = ts.createSourceFile('platform.d.ts', source, ts.ScriptTarget.Latest, true)
  const edits = []
  function visit(node) {
    if (ts.isStringLiteral(node) && names.has(node.text)) {
      edits.push({ start: node.getStart(file), end: node.end, text: JSON.stringify(`./${names.get(node.text)}.js`) })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  let result = source
  for (const edit of edits.reverse()) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }
  return result
}

async function writeInput(name, source) {
  const filename = path.join(outputDirectory, `${name}.d.ts`)
  const current = await fs.readFile(filename, 'utf8').catch(() => undefined)
  if (current !== source) {
    await fs.writeFile(filename, source)
  }
}

await fs.mkdir(outputDirectory, { recursive: true })
const wechatManifest = require.resolve('miniprogram-api-typings/package.json')
const alipayRequire = createRequire(require.resolve('@mini-types/alipay/package.json'))
const alipayManifest = alipayRequire.resolve('@mini-types/my/package.json')
for (const [name, manifest, exported] of [
  ['wechat', wechatManifest, 'WechatMiniprogram'],
  ['alipay', alipayManifest, 'my'],
]) {
  const metadata = JSON.parse(await fs.readFile(manifest, 'utf8'))
  const packageRoot = path.dirname(manifest)
  const entry = path.resolve(packageRoot, metadata.types)
  const { source } = await scopedDeclarations(entry, exported, packageRoot)
  if (name === 'wechat') {
    await writeWechatModules(source, exported)
  }
  else {
    await writeInput(name, `${source}\nexport { ${exported} }\n`)
  }
}
