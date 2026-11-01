import type { Plugin } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPackageImportsQueryPlugin } from './index'

let directory: string

beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'package-imports-build-'))
  await fs.mkdir(path.join(directory, 'lib'))
  await fs.mkdir(path.join(directory, 'lib', 'required'))
  const dependency = path.join(directory, 'node_modules', 'imports-dependency')
  await fs.mkdir(dependency, { recursive: true })
  await fs.writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'imports-dependency', type: 'module' }))
  await fs.writeFile(path.join(dependency, 'part.js'), 'export const value = "dependency-file"\n')
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name: 'imports-build-fixture',
    type: 'module',
    imports: {
      '#wild/*': './lib/*.js',
      '#exact': './lib/part.js',
      '#literal?query': './lib/part.js',
      '#literal#fragment': './lib/part.js',
      '#wild#literal/*': './lib/*.js',
      '#mode/*': { custom: './lib/custom.js', default: './lib/*.js' },
      '#common/*': { require: './lib/required/*.js', import: './lib/*.js' },
      '#dependency/*': 'imports-dependency/*.js',
      '#blocked': './lib/part.js',
      '#blocked?query': { absent: './lib/part.js' },
    },
  }))
  await fs.writeFile(path.join(directory, 'lib', 'part.js'), 'export const value = "existing-file"\n')
  await fs.writeFile(path.join(directory, 'lib', 'custom.js'), 'export const value = "custom-file"\n')
  await fs.writeFile(path.join(directory, 'lib', 'required', 'part.js'), 'export const value = "require-selected-file"\n')
})

afterAll(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

async function buildSource(source: string, plugins: Plugin[] = [], conditions: string[] = [], filename = 'entry.js') {
  const entry = path.join(directory, filename)
  await fs.writeFile(entry, source)
  const result = await build({
    root: directory,
    configFile: false,
    logLevel: 'silent',
    plugins: [createPackageImportsQueryPlugin(), ...plugins],
    resolve: { conditions },
    build: { write: false, minify: false, lib: { entry, formats: ['es'] } },
  })
  return (Array.isArray(result) ? result : [result]).flatMap(output => 'output' in output ? output.output : []).filter(output => output.type === 'chunk').map(output => output.code).join('\n')
}

describe('package imports query through the public Vite build pipeline', () => {
  it('preserves ordinary wildcard JavaScript imports', async () => {
    expect(await buildSource('export { value } from "#wild/part";')).toContain('existing-file')
  })

  it.each([
    '#wild/part?raw',
    '#wild/part?raw&flag#anchor',
    '#exact?raw',
    '#literal?query?raw',
    '#literal#fragment?raw',
    '#wild#literal/part?raw',
  ])('loads raw source from %s', async (id) => {
    const output = await buildSource(`import source from ${JSON.stringify(id)}; export default source;`)
    expect(output).toContain('export const value =')
    expect(output).toContain('existing-file')
  })

  it('preserves custom condition mapping', async () => {
    const output = await buildSource('import source from "#mode/part?raw"; export default source;', [], ['custom'])
    expect(output).toContain('custom-file')
  })

  it('resolves CommonJS require-call conditions through the public resolver', async () => {
    const output = await buildSource('module.exports = require("#common/part?raw")', [], [], 'entry.cjs')
    expect(output).toContain('export const value =')
    expect(output).toContain('require-selected-file')
    expect(output).not.toContain('existing-file')
  })

  it('resolves wildcard imports mapped to dependency files', async () => {
    const output = await buildSource('export { default } from "#dependency/part?raw";')
    expect(output).toContain('export const value =')
    expect(output).toContain('dependency-file')
  })

  it.each(['#literal?query', '#literal#fragment'])('preserves the literal exact key %s', async (id) => {
    const output = await buildSource(`export { value } from ${JSON.stringify(id)};`)
    expect(output).toContain('existing-file')
  })

  it('preserves an explicit unmatched exact mapping error', async () => {
    await expect(buildSource('import source from "#blocked?query"; export default source;')).rejects.toThrow('No known conditions for "#blocked?query"')
  })

  it('allows a later pre resolver to own the complete id', async () => {
    const custom: Plugin = {
      name: 'complete-id-owner',
      enforce: 'pre',
      resolveId(id) {
        if (id === '#wild/part?raw') {
          return '\0complete-id-owned'
        }
      },
      load(id) {
        if (id === '\0complete-id-owned') {
          return 'export default "custom-owned-result"'
        }
      },
    }
    expect(await buildSource('export { default } from "#wild/part?raw";', [custom])).toContain('custom-owned-result')
  })
})
