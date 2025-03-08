import fs from 'fs-extra'
import path from 'pathe'
import { parse } from 'vue/compiler-sfc'

describe('index', () => {
  it('foo bar', async () => {
    const ast = parse(await fs.readFile(path.resolve(import.meta.dirname, './fixtures/case0.vue'), 'utf8'), {

    })
    expect(ast).toBeTruthy()
  })
})
