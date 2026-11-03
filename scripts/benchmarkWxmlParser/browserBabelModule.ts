import * as parser from '@babel/parser'

/** 只适配 scanner 已有的 Babel parser 加载，不模拟其他 Node 模块。 */
export function createRequire() {
  return (id: string) => {
    if (id === '@babel/parser') {
      return parser
    }
    throw new Error(`Unsupported browser benchmark module: ${id}`)
  }
}
