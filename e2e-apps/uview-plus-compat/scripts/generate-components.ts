import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import { generateComponentLibraryPages } from '../../../e2e/component-library/generator'
import { getComponentMarkup } from './componentMarkup'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appRoot, '../..')
const packageRoot = resolve(appRoot, 'node_modules/uview-plus')
const resolverListPath = resolve(repoRoot, 'packages/weapp-vite/src/auto-import-components/resolvers/json/uviewPlus.json')
const anonymousEntries = ['u-action-sheet-data', 'u-column-notice']
const checkOnly = process.argv.includes('--check')

function readComponentName(source: string) {
  for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const script = match[1]
    if (!script.trim()) {
      continue
    }
    const program = parse(script, {
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true,
    }).program
    const declaration = program.body.find(node => node.type === 'ExportDefaultDeclaration')
    if (!declaration || declaration.type !== 'ExportDefaultDeclaration') {
      continue
    }
    const options = declaration.declaration.type === 'ObjectExpression'
      ? declaration.declaration
      : declaration.declaration.type === 'CallExpression' && declaration.declaration.arguments[0]?.type === 'ObjectExpression'
        ? declaration.declaration.arguments[0]
        : undefined
    const name = options?.properties.find((property) => {
      return property.type === 'ObjectProperty'
        && ((property.key.type === 'Identifier' && property.key.name === 'name')
          || (property.key.type === 'StringLiteral' && property.key.value === 'name'))
    })
    if (name?.type === 'ObjectProperty' && name.value.type === 'StringLiteral') {
      return name.value.value
    }
  }
  return undefined
}

async function readPublishedComponents() {
  const entries = await readdir(resolve(packageRoot, 'components'), { withFileTypes: true })
  const candidateEntries = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('u-'))
    .map(entry => entry.name)
    .toSorted()
  const sourceEntries: string[] = []
  const namedEntries: string[] = []
  const unnamedEntries: string[] = []
  for (const entry of candidateEntries) {
    const filename = resolve(packageRoot, 'components', entry, `${entry}.vue`)
    const source = await readFile(filename, 'utf8').catch(() => '')
    if (!source) {
      continue
    }
    sourceEntries.push(entry)
    if (readComponentName(source)) {
      namedEntries.push(entry)
    }
    else {
      unnamedEntries.push(entry)
    }
  }
  return { namedEntries, sourceEntries, unnamedEntries }
}

async function main() {
  const [{ namedEntries, sourceEntries, unnamedEntries }, resolverSource] = await Promise.all([
    readPublishedComponents(),
    readFile(resolverListPath, 'utf8'),
  ])
  const resolverComponents = (JSON.parse(resolverSource) as string[]).toSorted()
  if (sourceEntries.length !== 139 || JSON.stringify(sourceEntries) !== JSON.stringify(resolverComponents)) {
    throw new Error(`uview-plus 源码入口与 resolver 不一致: source=${sourceEntries.length}, resolver=${resolverComponents.length}`)
  }
  if (namedEntries.length !== 137 || JSON.stringify(unnamedEntries) !== JSON.stringify(anonymousEntries)) {
    throw new Error(`uview-plus 具名组件清单异常: named=${namedEntries.length}, anonymous=${unnamedEntries.join(',')}`)
  }
  const components = namedEntries.map(component => `up-${component.slice('u-'.length)}`)
  await generateComponentLibraryPages({
    appRoot,
    checkOnly,
    components,
    getComponentMarkup,
    logPrefix: 'uview-plus',
    projectDescription: 'uview-plus 全组件启动条件',
    projectName: 'uview-plus-compat',
    title: 'uview-plus',
    versionLabel: 'uview-plus 3.8.108',
  })
}

await main()
