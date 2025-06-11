import path from 'node:path'

export function canExternalizeFile(filePath: string): boolean {
  const ext = path.extname(filePath)
  // only external js imports
  return !ext || ext === '.js' || ext === '.mjs' || ext === '.cjs'
}
