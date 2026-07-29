import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { generateComponentLibraryPages } from '../../../e2e/component-library/generator'
import { getComponentMarkup } from './componentMarkup'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appRoot, '../..')
const resolverListPath = resolve(repoRoot, 'packages/weapp-vite/src/auto-import-components/resolvers/json/wotUi.json')
const globalTypesPath = resolve(appRoot, 'node_modules/@wot-ui/ui/global.d.ts')
const checkOnly = process.argv.includes('--check')

function parseGlobalComponents(source: string) {
  return [...source.matchAll(/components\/(wd-[^/]+)\/\1\.vue/g)]
    .map(match => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort()
}

async function main() {
  const [globalTypes, resolverSource] = await Promise.all([
    readFile(globalTypesPath, 'utf8'),
    readFile(resolverListPath, 'utf8'),
  ])
  const components = parseGlobalComponents(globalTypes)
  const resolverComponents = (JSON.parse(resolverSource) as string[]).toSorted()
  if (components.length !== 99 || JSON.stringify(components) !== JSON.stringify(resolverComponents)) {
    throw new Error(`Wot UI 声明与 resolver 不一致: global=${components.length}, resolver=${resolverComponents.length}`)
  }

  await generateComponentLibraryPages({
    appRoot,
    checkOnly,
    components,
    getComponentMarkup,
    logPrefix: 'wot-ui',
    projectDescription: 'Wot UI 全组件启动条件',
    projectName: 'wot-ui-compat',
    title: 'Wot UI',
    versionLabel: 'Wot UI 2.2.0',
  })
}

await main()
