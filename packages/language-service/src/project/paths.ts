import path from 'node:path'

type PathApi = Pick<typeof path, 'resolve' | 'relative' | 'dirname' | 'isAbsolute' | 'sep'>

/** 由项目内相对路径限定祖先层数，兼容 glob 的正斜杠路径并禁止越过项目根。 */
export function projectAncestorDirectories(root: string, file: string, pathApi: PathApi = path): string[] {
  root = pathApi.resolve(root)
  const relative = pathApi.relative(root, pathApi.dirname(pathApi.resolve(file)))
  if (relative === '..' || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative)) {
    throw new Error('项目检查路径必须位于配置所属项目内')
  }
  const segments = relative ? relative.split(pathApi.sep) : []
  const directories: string[] = []
  for (let depth = segments.length; depth >= 0; depth--) {
    directories.push(pathApi.resolve(root, ...segments.slice(0, depth)))
  }
  return directories
}
