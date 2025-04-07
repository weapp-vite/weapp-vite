import { init, parse } from 'cjs-module-lexer'
// import path from 'pathe'
// import { getApp } from './utils'

// const viteNativeRoot = getApp('vite-native')

// function r(...args: string[]) {
//   return path.resolve(viteNativeRoot, ...args)
// }

describe.skipIf(true)('wxs', () => {
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
