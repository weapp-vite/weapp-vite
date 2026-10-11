import path from 'node:path'

/** 只映射明确归属的源码路径；位置、源码文本、名称和未知来源保持原样。 */
export function canonicalSourceMapRoots(map: Record<string, unknown>, mapFile: string, roots: string[]) {
  if (!Array.isArray(map.sources) || map.sources.some(source => typeof source !== 'string')) {
    throw new Error('Expected string sourcemap sources')
  }
  if (map.sourceRoot !== undefined && map.sourceRoot !== '') {
    throw new Error('Cross-checkout evidence requires an empty sourcemap sourceRoot')
  }
  const owners = roots.map((root, index) => ({ root: path.resolve(root), index })).sort((a, b) => b.root.length - a.root.length)
  return {
    ...map,
    sources: map.sources.map((source: string) => {
      if (/^[a-z][a-z\d+.-]*:/i.test(source) && !path.isAbsolute(source)) {
        return source
      }
      const absolute = path.resolve(path.dirname(mapFile), source)
      for (const owner of owners) {
        const relative = path.relative(owner.root, absolute)
        if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
          return `<source-root:${owner.index}>/${relative.split(path.sep).join('/')}`
        }
      }
      return source
    }),
  }
}
