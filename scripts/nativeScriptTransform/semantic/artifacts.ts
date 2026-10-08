import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { digest } from '../identity'

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

/** 只读取本次目录内的证据，并保留每份原始字节的身份以供结束时复核。 */
export function compilerArtifacts(directory: string) {
  const hashes: Record<string, string> = {}
  const read = async (filename: string): Promise<unknown> => {
    ensure(!path.isAbsolute(filename) && !filename.split(/[\\/]/).includes('..'), 'Compiler evidence path escapes its directory')
    const raw = await readFile(path.join(directory, filename))
    const hash = digest(raw)
    ensure(hashes[filename] === undefined || hashes[filename] === hash, 'Compiler evidence changed during reading')
    hashes[filename] = hash
    return JSON.parse(raw.toString('utf8')) as unknown
  }
  const verify = async () => {
    const current = Object.fromEntries(await Promise.all(Object.keys(hashes).map(async filename => [filename, digest(await readFile(path.join(directory, filename)))])))
    ensure(isDeepStrictEqual(current, hashes), 'Compiler evidence changed during semantic execution')
    return { ...hashes }
  }
  return { hashes, read, verify }
}

export type CompilerArtifacts = ReturnType<typeof compilerArtifacts>
