export function describeIndependentSubpackage(scope: string) {
  return `${scope} 只引用自身依赖，便于对比独立分包的打包行为`
}
