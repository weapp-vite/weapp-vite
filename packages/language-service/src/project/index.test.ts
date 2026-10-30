import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeProject, collectProjectFiles, loadProjectConfig, resolveProjectDocumentInput, resolveProjectReference } from './index'

const roots: string[] = []

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), 'mini-language-project-'))
  roots.push(root)
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(root, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, source)
  }
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('project document ownership', () => {
  it('propagates platform through relative template imports and cyclic script imports', async () => {
    const root = await fixture({
      'src/index.axml': '<import-sjs name="tools" from="./tools.sjs" />',
      'src/tools.sjs': 'import helper from "./helper.sjs"; export default helper',
      'src/helper.sjs': 'import tools from "./tools.sjs"; export default { tools }',
    })
    const documents = await analyzeProject(root)
    expect(documents.map(document => [document.fileName, document.platform])).toEqual([
      ['src/helper.sjs', 'alipay'],
      ['src/index.axml', 'alipay'],
      ['src/tools.sjs', 'alipay'],
    ])
    expect(documents.every(document => document.analysis.valid)).toBe(true)
  })

  it('requires explicit configuration for an orphan or ambiguous SJS module', async () => {
    const root = await fixture({
      'src/a.axml': '<import-sjs name="tools" from="./tools.sjs" />',
      'src/b.ttml': '<sjs module="tools" src="./tools.sjs" />',
      'src/tools.sjs': 'module.exports = {}',
      'src/orphan.sjs': 'module.exports = {}',
    })
    const documents = await analyzeProject(root)
    expect(documents.find(document => document.fileName.endsWith('tools.sjs'))?.analysis.diagnostics).toContainEqual(expect.objectContaining({ code: 'language/ambiguous-platform', severity: 'error' }))
    expect(documents.find(document => document.fileName.endsWith('orphan.sjs'))?.analysis.valid).toBe(false)
    const configured = await analyzeProject(root, ['.'], { overrides: [{ files: ['src/*.sjs'], platform: 'alipay' }] })
    expect(configured.every(document => document.analysis.valid)).toBe(true)
  })

  it('uses unsaved editor source and the same owner graph as CLI', async () => {
    const root = await fixture({ 'src/index.axml': '<import-sjs name="tools" from="./tools.sjs" />', 'src/tools.sjs': 'export default {}' })
    const source = 'export default { value: 42 }'
    const input = await resolveProjectDocumentInput({ root, language: {} }, 'src/tools.sjs', source)
    expect(input).toMatchObject({ source, fileName: 'src/tools.sjs', platform: 'alipay' })
  })

  it('follows project-root paths, compiled alternatives and ordinary filter JS modules', async () => {
    const root = await fixture({
      'src/page.axml': '<import-sjs name="tools" from="/modules/tools.sjs" />',
      'modules/tools.sjs.ts': 'export default { value: 1 as number }',
      'src/page.swan': '<filter module="tools" src="./tools.filter.js" />',
      'src/tools.filter.js': 'var helper = require("./helper.js"); export default { format: function () { return helper.value } }',
      'src/helper.js': 'module.exports = { value: 1 }',
      'src/unrelated.js': 'window.open()',
    })
    const documents = await analyzeProject(root)
    expect(documents.every(document => document.analysis.valid)).toBe(true)
    expect(documents.map(document => document.fileName)).not.toContain('src/unrelated.js')
    expect(documents.find(document => document.fileName === 'modules/tools.sjs.ts')).toMatchObject({ platform: 'alipay', analysis: { script: { sourceKind: 'compiled', dialect: 'sjs' } } })
    expect(documents.find(document => document.fileName === 'src/tools.filter.js')).toMatchObject({ platform: 'swan', input: { sourceKind: 'native', dialect: 'javascript' } })
    expect(documents.find(document => document.fileName === 'src/helper.js')?.platform).toBe('swan')
    expect(await resolveProjectReference({ root, language: {} }, 'src/page.axml', '/modules/tools.sjs')).toBe(path.join(root, 'modules/tools.sjs.ts'))
    expect(await resolveProjectDocumentInput({ root, language: {} }, 'src/tools.filter.js', 'export default { value: function () { return 1 } }')).toMatchObject({ dialect: 'javascript', sourceKind: 'native', platform: 'swan' })
  })

  it('discovers dependencies from a native suffix explicitly declared as typed source', async () => {
    const root = await fixture({
      'page.ttml': '<sjs module="tools" src="./entry.sjs" lang="ts" />',
      'entry.sjs': 'import native from "./child.sjs"; const value: number = 1; export default { native, value }',
      'child.sjs': 'module.exports = { value: 1 }',
    })
    const documents = await analyzeProject(root)
    expect(documents.every(document => document.analysis.valid)).toBe(true)
    expect(documents.find(document => document.fileName === 'child.sjs')?.platform).toBe('tt')
    expect(documents.find(document => document.fileName === 'entry.sjs')?.input).toMatchObject({ sourceKind: 'compiled', language: 'typescript' })
  })

  it('does not leak entry compilation flags into a native module dependency', async () => {
    const root = await fixture({
      'page.ttml': '<sjs module="tools" src="./entry.js" lang="ts" />',
      'entry.js': 'import native from "./native.sjs"; export default native',
      'native.sjs': 'module.exports = new Date()',
    })
    const documents = await analyzeProject(root)
    expect(documents.find(document => document.fileName === 'entry.js')?.analysis.valid).toBe(true)
    expect(documents.find(document => document.fileName === 'native.sjs')).toMatchObject({ platform: 'tt', analysis: { script: { sourceKind: 'native' }, valid: false } })
    expect(documents.find(document => document.fileName === 'native.sjs')?.analysis.diagnostics).toContainEqual(expect.objectContaining({ code: 'script/sjs-constructor' }))
  })

  it('keeps explicit platform overrides ahead of inferred and project defaults', async () => {
    const root = await fixture({ 'page.axml': '<import-sjs name="tools" from="./tools.sjs" />', 'tools.sjs': 'module.exports = {}' })
    const documents = await analyzeProject(root, ['.'], { defaultPlatform: 'weapp', overrides: [{ files: ['tools.sjs'], platform: 'tt' }] })
    expect(documents.find(document => document.fileName === 'page.axml')?.platform).toBe('alipay')
    expect(documents.find(document => document.fileName === 'tools.sjs')?.platform).toBe('tt')
  })

  it('propagates a standalone module override through its static dependencies', async () => {
    const root = await fixture({
      'entry.sjs': 'var child = require("./child.sjs"); module.exports = child',
      'child.sjs': 'module.exports = { value: 1 }',
      'typed.sjs.ts': 'import helper from "./helper.js"; export default helper',
      'helper.js': 'module.exports = { value: 1 }',
    })
    const documents = await analyzeProject(root, ['.'], { overrides: [{ files: ['entry.sjs', 'typed.sjs.ts'], platform: 'tt' }] })
    expect(documents.map(document => [document.fileName, document.platform])).toEqual([['child.sjs', 'tt'], ['entry.sjs', 'tt'], ['helper.js', 'tt'], ['typed.sjs.ts', 'tt']])
    expect(documents.flatMap(document => document.analysis.diagnostics)).toEqual([])
  })

  it('applies each module override before passing its platform to children', async () => {
    const root = await fixture({
      'page.axml': '<import-sjs name="tools" from="./entry.sjs" />',
      'entry.sjs': 'var child = require("./child.sjs"); module.exports = child',
      'child.sjs': 'module.exports = new Date()',
    })
    const documents = await analyzeProject(root, ['.'], { overrides: [{ files: ['entry.sjs'], platform: 'tt' }] })
    const child = documents.find(document => document.fileName === 'child.sjs')!
    expect(child.platform).toBe('tt')
    expect(child.analysis.diagnostics).toContainEqual(expect.objectContaining({ code: 'script/sjs-constructor' }))
  })

  it('loads trusted language configuration and rejects invalid platform metadata', async () => {
    const root = await fixture({
      'package.json': '{"name":"language-config","type":"module"}',
      'vite.config.mjs': 'export default {weapp:{platform:"weapp",language:{overrides:[{files:["src/**/*.sjs"],platform:"tt"}]}},fmt:{printWidth:100}}',
    })
    expect(await loadProjectConfig(root)).toMatchObject({ root, fmt: { printWidth: 100 }, language: { defaultPlatform: 'weapp', overrides: [{ files: ['src/**/*.sjs'], platform: 'tt' }] } })
    await writeFile(path.join(root, 'explicit.config.mjs'), 'export default {weapp:{platform:"weapp",language:{defaultPlatform:"tt"}}}')
    expect(await loadProjectConfig(root, { configFile: 'explicit.config.mjs' })).toMatchObject({ language: { defaultPlatform: 'tt' } })
    await writeFile(path.join(root, '.oxlintrc.json'), '{"ignorePatterns":["src/vendor/**"]}')
    expect(await loadProjectConfig(root, { configFile: '.oxlintrc.json', configKind: 'lint' })).toMatchObject({ root, lint: { ignorePatterns: ['src/vendor/**'] }, language: { defaultPlatform: 'weapp' } })
    await writeFile(path.join(root, '.oxfmtrc.json'), '{"tabWidth":4}')
    expect(await loadProjectConfig(root, { configFile: '.oxfmtrc.json' })).toMatchObject({ root, fmt: { tabWidth: 4 }, language: { defaultPlatform: 'weapp' } })
    await writeFile(path.join(root, 'invalid.config.mjs'), 'export default {weapp:{language:{platform:"unknown"}}}')
    await expect(loadProjectConfig(root, { configFile: 'invalid.config.mjs' })).rejects.toThrow('无效的 weapp.language.platform')
  })

  it('normalizes inputs, honors nested ignore files and rejects escaping roots', async () => {
    const root = await fixture({ '.gitignore': 'src/ignored.axml\n', 'src/ignored.axml': '<view/>', 'src/keep.axml': '<view/>', 'src/child/.gitignore': '*.sjs\n', 'src/child/ignored.sjs': 'invalid', 'dist/out.wxml': 'invalid' })
    expect((await collectProjectFiles(root)).filter(file => /\.(?:axml|sjs|wxml)$/.test(file)).map(file => path.relative(root, file))).toEqual([path.join('src', 'keep.axml')])
    expect(await collectProjectFiles(path.relative('.', root))).toEqual(await collectProjectFiles(root))
    await expect(collectProjectFiles(root, ['../outside'])).rejects.toThrow('所属项目内')
  })
})
