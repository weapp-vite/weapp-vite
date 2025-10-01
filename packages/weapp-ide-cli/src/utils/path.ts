import process from 'node:process'
import path from 'pathe'

export function resolvePath(filePath: string) {
  if (path.isAbsolute(filePath)) {
    return filePath
  }

  return path.resolve(process.cwd(), filePath)
}
