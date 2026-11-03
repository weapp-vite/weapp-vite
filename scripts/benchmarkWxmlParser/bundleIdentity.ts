import type { Metafile } from 'esbuild'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { hash, repositoryRoot } from './freeze'

export async function recordFiles(files: readonly string[], artifacts: Record<string, string>) {
  for (const file of files) {
    artifacts[path.relative(repositoryRoot, file).replaceAll('\\', '/')] = hash(await readFile(file))
  }
}

export function recordBuildInputs(metafile: Metafile, artifacts: Record<string, string>) {
  return recordFiles(Object.keys(metafile.inputs).filter(file => file !== '<stdin>').map(file => path.resolve(repositoryRoot, file)), artifacts)
}
