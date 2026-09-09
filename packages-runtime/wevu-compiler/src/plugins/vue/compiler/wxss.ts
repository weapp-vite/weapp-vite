/** 保留兼容入口；WXSS 支持嵌套变量回退，不得丢弃依赖级联的内层变量。 */
export function transformNestedWxssVars(source: string) {
  return source
}
