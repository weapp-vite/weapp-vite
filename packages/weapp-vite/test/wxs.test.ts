import { buildWxs } from '@/utils/wxs'
import { init, parse } from 'cjs-module-lexer'
import path from 'pathe'
import { getApp } from './utils'

const viteNativeRoot = getApp('vite-native')

function r(...args: string[]) {
  return path.resolve(viteNativeRoot, ...args)
}

describe('wxs', () => {
  it('build wxs case 0', async () => {
    await buildWxs({
      entry: [
        r('pages/index/index.wxs.ts'),
      ],
      outDir: path.resolve(__dirname, './fixtures/wxsCase0'),
      outbase: viteNativeRoot,
      clean: true,
    })
  })

  it('build wxs case 1', async () => {
    await buildWxs({
      entry: [
        r('pages/index/cjs.wxs'),
      ],
      outDir: path.resolve(__dirname, './fixtures/wxsCase1'),
      outbase: viteNativeRoot,
      clean: true,
    })
  })

  it('build wxs case 4', async () => {
    await buildWxs({
      entry: [
        r('pages/index/esm.wxs'),
      ],
      outDir: path.resolve(__dirname, './fixtures/wxsCase4'),
      outbase: viteNativeRoot,
      clean: true,
    })
  })

  it('build wxs case 2', async () => {
    await buildWxs({
      entry: [
        r('pages/index/test.ts'),
      ],
      outDir: path.resolve(__dirname, './fixtures/wxsCase2'),
      tsconfig: r('tsconfig.json'),
      outbase: viteNativeRoot,
      clean: true,
    })
  })

  it('build wxs case 3', async () => {
    await buildWxs({
      entry: [
        r('pages/index/index.wxs.js'),
      ],
      outDir: path.resolve(__dirname, './fixtures/wxsCase3'),
      outbase: viteNativeRoot,
      clean: true,
    })
  })

  it('code parse', async () => {
    await init()
    const code = `var tools = require("./tools.wxs");

console.log(tools.FOO);
console.log(tools.bar("logic.wxs"));
console.log(tools.msg);`
    const { exports, reexports } = parse(code)
    console.log(exports, reexports)
  })
})
