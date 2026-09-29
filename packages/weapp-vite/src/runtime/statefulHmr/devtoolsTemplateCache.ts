/** 清理 IDE 局部模板编译留下的空缓存，使旧页面的编译函数可以重新初始化指令。 */
export const devtoolsTemplateCacheSource = `
function invalidateDevtoolsTemplatePlaceholders() {
  if (typeof __WXML_GLOBAL__ === 'undefined') return;
  const cache = __WXML_GLOBAL__?.ops_cached;
  if (!cache || typeof cache !== 'object') return;
  for (const [key, value] of Object.entries(cache)) {
    if (Array.isArray(value) && value.length === 0) delete cache[key];
  }
}
`
