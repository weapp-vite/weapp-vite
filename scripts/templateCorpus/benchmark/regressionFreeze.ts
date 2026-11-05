import type { CorpusFileIdentity } from '../types'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 复用仓库跨平台进程执行及二进制标准输出能力。
import { execa } from 'execa'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'
import { isDirectExecution } from '../test/harness'

/** 批量读取 Git blob，不执行候选仓库脚本；旧 corpus 单独冻结，不复制到比较实现快照。 */
export async function freezeRegressionSource(ref: string, output: string): Promise<string> {
  const git = (args: string[], input?: string) => execa('git', args, { cwd: repositoryRoot, input, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })
  const resolved = Buffer.from((await git(['rev-parse', `${ref}^{commit}`])).stdout).toString('utf8').trim()
  if (resolved !== ref) {
    throw new Error('Regression source must use an exact forty-character commit identity')
  }
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const entries = Buffer.from((await git(['ls-tree', '-r', '-z', ref])).stdout).toString('utf8').split('\0').filter(Boolean).map((row) => {
    const match = /^(\d+) blob [\da-f]+\t(.+)$/.exec(row)
    if (!match) {
      throw new Error('Regression source tree contains an unsupported submodule entry')
    }
    return { mode: match[1]!, file: match[2]! }
  }).filter(entry => !entry.file.startsWith('packages/wxml/test/corpus/'))
  const input = entries.map(entry => `${ref}:${entry.file}`).join('\n')
  const raw = Buffer.from((await git(['cat-file', '--batch'], `${input}\n`)).stdout)
  const files: CorpusFileIdentity[] = []
  let offset = 0
  let lockSha256 = ''
  for (const entry of entries) {
    const end = raw.indexOf(10, offset)
    const match = /^[\da-f]+ blob (\d+)$/.exec(raw.subarray(offset, end).toString('utf8'))
    if (!match) {
      throw new Error('Invalid batched Git blob response')
    }
    const bytes = Number(match[1])
    const content = raw.subarray(end + 1, end + 1 + bytes)
    offset = end + bytes + 2
    if (content.length !== bytes || raw[offset - 1] !== 10) {
      throw new Error('Truncated batched Git blob response')
    }
    const file = path.join(output, entry.file)
    await mkdir(path.dirname(file), { recursive: true })
    if (entry.mode === '120000') {
      throw new Error('Regression baseline source contains a symbolic link; inspect it before freezing')
    }
    await writeFile(file, content, { mode: entry.mode === '100755' ? 0o755 : 0o644 })
    const sha256 = corpusHash(content)
    files.push({ file: entry.file, bytes, sha256 })
    if (entry.file === 'pnpm-lock.yaml') {
      lockSha256 = sha256
    }
  }
  if (offset !== raw.length || !lockSha256) {
    throw new Error('Unexpected trailing blob data or missing original lockfile')
  }
  const identity = { schemaVersion: 1, ref, lockSha256, boundary: 'git archive commit; immutable corpus bytes remain separately frozen and are not duplicated into baseline checkout', excluded: ['packages/wxml/test/corpus'], files }
  const manifest = path.join(path.dirname(output), 'baseline-source-identity.json')
  const serialized = JSON.stringify(identity, null, 2).replace(/[\u0080-\uFFFF]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
  await writeFile(manifest, Buffer.from(`${serialized}\n`), { flag: 'wx' })
  return manifest
}

if (isDirectExecution(import.meta.url)) {
  const { values } = parseArgs({ options: { ref: { type: 'string' }, output: { type: 'string' } } })
  if (!values.ref || !values.output) {
    throw new Error('--ref and --output are required')
  }
  process.stdout.write(`${await freezeRegressionSource(values.ref, path.resolve(values.output))}\n`)
}
