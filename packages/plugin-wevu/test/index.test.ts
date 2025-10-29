import { parse as parseJson, stringify } from 'comment-json'
import fs from 'fs-extra'
import { recursive } from 'merge'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'

describe('index', () => {
  it('foo bar', async () => {
    const filename = path.resolve(import.meta.dirname, './fixtures/case0.vue')
    const ast = parse(await fs.readFile(filename, 'utf8'), {
      filename,
    })
    expect(ast).toBeTruthy()
    const { descriptor, errors } = ast
    expect(errors.length).toBe(0)
    const { template, script, styles, customBlocks } = descriptor
    expect(template).toBeTruthy()
    expect(script).toBeTruthy()
    expect(styles).toBeTruthy()
    expect(customBlocks).toBeTruthy()
    const outDir = path.dirname(filename)
    script && fs.outputFile(path.resolve(outDir, 'output', 'case0.js'), script.content.trim())
    template && fs.outputFile(path.resolve(outDir, 'output', 'case0.wxml'), template.content.trim())

    fs.outputFile(path.resolve(outDir, 'output', 'case0.wxss'), styles.map(x => x.content.trim()).join('\n').trim())

    const configJson = customBlocks.filter(x => x.type === 'config').reduce((acc, cur) => {
      recursive(acc, parseJson(cur.content))
      return acc
    }, {})
    fs.outputFile(path.resolve(outDir, 'output', 'case0.json'), stringify(configJson, null, 2))
  })
})
