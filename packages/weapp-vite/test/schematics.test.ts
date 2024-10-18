import { generate } from '@/schematics'
// import fs from 'fs-extra'
import path from 'pathe'

describe('schematics', () => {
  describe('generate', () => {
    const cwd = path.resolve(__dirname, './fixtures/schematics')
    it('generate case 0', async () => {
      await generate({
        outDir: 'case0',
        cwd,
      })
    })

    it('generate case 1', async () => {
      await generate({
        outDir: 'case1',
        cwd,
        extensions: {
          js: 'ts',
          json: 'ts',
          wxml: 'wxml',
          wxss: 'scss',
        },
      })
    })

    it('generate case 2', async () => {
      await generate({
        outDir: 'case2',
        cwd,
        extensions: {
          json: 'js',
          wxss: 'less',
        },
      })
    })
  })
})
