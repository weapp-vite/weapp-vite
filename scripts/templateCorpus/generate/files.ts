import type { CorpusFileIdentity } from '../types'
import type { GenerationMode } from './types'
import assert from 'node:assert/strict'
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash } from '../archive'

export function portablePath(value: string): string {
  return value.split(path.sep).join('/')
}

function portableSegments(file: string): string[] {
  const segments = file.split('/')
  assert.ok(file && !path.isAbsolute(file) && !/[\\:]/.test(file)
    && [...file].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    && segments.every(segment => segment && segment !== '.' && segment !== '..'), 'Unsafe generation output path')
  return segments
}

async function outputPath(project: string, file: string, mode: GenerationMode, directory = false): Promise<string> {
  assert.ok(mode === 'development' || mode === 'production', 'Invalid generation output mode')
  const segments = portableSegments(file)
  assert.ok(segments[0] === 'out' && segments[1] === mode && (directory || segments.length > 2), 'Generation output must stay within its mode root')
  let target = project
  const root = await lstat(target)
  assert.ok(root.isDirectory() && !root.isSymbolicLink(), 'Generation output project must be an ordinary directory')
  for (const [index, segment] of segments.entries()) {
    target = path.join(target, segment)
    const stat = await lstat(target)
    assert.ok(!stat.isSymbolicLink(), 'Symlink not allowed in generation output')
    assert.ok((directory || index < segments.length - 1) ? stat.isDirectory() : stat.isFile(), 'Generation output must contain ordinary directories and files')
  }
  return target
}

/** 仅清点当前模式的编译器产物；产物内的普通 npm 文件不等同于安装依赖目录。 */
export async function listOutputFiles(project: string, mode: GenerationMode): Promise<string[]> {
  async function visit(prefix: string): Promise<string[]> {
    const directory = await outputPath(project, prefix, mode, true)
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = `${prefix}/${entry.name}`
      assert.ok(!entry.isSymbolicLink(), 'Symlink not allowed in generation output')
      if (entry.isDirectory()) {
        files.push(...await visit(file))
      }
      else {
        assert.ok(entry.isFile(), 'Generation output must contain ordinary directories and files')
        await outputPath(project, file, mode)
        files.push(file)
      }
    }
    return files
  }
  return visit(`out/${mode}`)
}

/** 读取前逐段核对产物归属，避免冻结恢复时跟随符号链接。 */
export async function readOutputFile(project: string, file: string, mode: GenerationMode): Promise<Uint8Array> {
  return new Uint8Array(await readFile(await outputPath(project, file, mode)))
}

export async function outputFileIdentity(project: string, file: string, mode: GenerationMode): Promise<CorpusFileIdentity> {
  const bytes = await readOutputFile(project, file, mode)
  return { file, sha256: corpusHash(bytes), bytes: bytes.length }
}

/** 完整遍历受控输入，拒绝符号链接及可逃离工程的路径。 */
export async function listProjectFiles(directory: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    assert.ok(!entry.isSymbolicLink(), `Symlink not allowed in generation input: ${entry.name}`)
    const relative = path.join(prefix, entry.name)
    assert.ok(!/^(?:\.(?:babelrc|npmrc|pnpmfile)|(?:babel|postcss|vite|rollup|webpack|vue)\.config\.)/.test(entry.name), 'Executable upstream tool configuration is not accepted as source')
    if (entry.isDirectory()) {
      assert.ok(!['node_modules', '.git'].includes(entry.name), 'Generation input must contain source files only')
      files.push(...await listProjectFiles(directory, relative))
    }
    else {
      assert.ok(entry.isFile(), `Unsupported generation input entry: ${entry.name}`)
      files.push(portablePath(relative))
    }
  }
  return files
}

export async function fileIdentity(directory: string, file: string): Promise<CorpusFileIdentity> {
  assert.ok(file && !file.startsWith('/') && !file.includes('\\') && !file.split('/').includes('..'), 'Nonportable generation evidence path')
  const bytes = await readFile(path.join(directory, file))
  return { file, sha256: corpusHash(bytes), bytes: bytes.length }
}

export async function writeProjectFile(directory: string, file: string, source: string | Uint8Array): Promise<void> {
  assert.ok(file && !path.isAbsolute(file) && !file.includes('\\') && !file.split('/').includes('..'), 'Unsafe generated project path')
  const destination = path.join(directory, file)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, source)
}

export async function copyControlledInput(input: string, project: string): Promise<CorpusFileIdentity[]> {
  assert.ok((await lstat(input)).isDirectory(), 'Generation input must be a directory')
  const files = await listProjectFiles(input)
  assert.ok(files.length, 'Empty controlled generation input')
  const identities: CorpusFileIdentity[] = []
  for (const file of files) {
    const source = await readFile(path.join(input, file))
    await writeProjectFile(project, `src/${file}`, source)
    identities.push({ file, sha256: corpusHash(source), bytes: source.length })
  }
  return identities
}
