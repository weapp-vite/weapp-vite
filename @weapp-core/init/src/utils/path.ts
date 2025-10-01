import path from 'pathe'

export function resolveOutputPath(root: string, dest: string | undefined, fallback: string) {
  if (!dest) {
    return fallback
  }

  return path.isAbsolute(dest) ? dest : path.resolve(root, dest)
}
