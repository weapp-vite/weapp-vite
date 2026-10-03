import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUploadEnv } from './env'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-env-'))
  vi.stubEnv('DOTENV_PRIVATE_KEY', undefined)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

describe('upload credential environment', () => {
  it('uses mode-local files below Vite root with expansion and process overrides', async () => {
    const envDir = path.join(directory, 'app', 'config')
    await mkdir(envDir, { recursive: true })
    await writeFile(path.join(directory, '.env.production.local'), 'UPLOAD_TEST_TOKEN=wrong-root')
    await writeFile(path.join(envDir, '.env'), 'UPLOAD_TEST_TOKEN=base\nUPLOAD_TEST_EXPAND=$UPLOAD_TEST_LATER\nUPLOAD_TEST_LATER=expanded\nUPLOAD_TEST_INHERIT=$UPLOAD_TEST_PROCESS')
    await writeFile(path.join(envDir, '.env.local'), 'UPLOAD_TEST_TOKEN=local')
    await writeFile(path.join(envDir, '.env.production'), 'UPLOAD_TEST_TOKEN=mode')
    await writeFile(path.join(envDir, '.env.production.local'), 'UPLOAD_TEST_TOKEN=mode-local\nUPLOAD_TEST_PROCESS=file')
    vi.stubEnv('UPLOAD_TEST_PROCESS', 'ci-secret')
    const result = await loadUploadEnv(directory, 'production', 'app', 'config')
    expect(result.UPLOAD_TEST_TOKEN).toBe('mode-local')
    expect(result.UPLOAD_TEST_EXPAND).toBe('expanded')
    expect(result.UPLOAD_TEST_PROCESS).toBe('ci-secret')
    expect(result.UPLOAD_TEST_INHERIT).toBe('ci-secret')
    expect(process.env.UPLOAD_TEST_TOKEN).toBeUndefined()
  })

  it('does not load files when envDir is disabled, preserving even empty process values', async () => {
    await writeFile(path.join(directory, '.env'), 'UPLOAD_TEST_PROCESS=file')
    vi.stubEnv('UPLOAD_TEST_PROCESS', '')
    expect((await loadUploadEnv(directory, 'production', undefined, false)).UPLOAD_TEST_PROCESS).toBe('')
    expect((await loadUploadEnv(directory, 'production')).UPLOAD_TEST_PROCESS).toBe('')
  })

  it('expands commands and leaves encrypted values unchanged without a private key', async () => {
    await writeFile(path.join(directory, '.env'), [
      `UPLOAD_TEST_COMMAND=$("${process.execPath}" -p "6 * 7")`,
      'UPLOAD_TEST_ENCRYPTED=encrypted:opaque-upload-token',
    ].join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_COMMAND).toBe('42')
    expect(result.UPLOAD_TEST_ENCRYPTED).toBe('encrypted:opaque-upload-token')
    expect(process.env.UPLOAD_TEST_COMMAND).toBeUndefined()
  })

  it('skips file expansion for process overrides, including empty and identical values', async () => {
    const command = `$("${process.execPath}" -e "process.exit(1)")`
    vi.stubEnv('UPLOAD_TEST_EMPTY', '')
    vi.stubEnv('UPLOAD_TEST_IDENTICAL', command)
    vi.stubEnv('UPLOAD_TEST_ENCRYPTED', 'encrypted:opaque-upload-token')
    vi.stubEnv('DOTENV_PRIVATE_KEY', 'invalid-private-key')
    await writeFile(path.join(directory, '.env'), [
      `UPLOAD_TEST_EMPTY=${command}`,
      `UPLOAD_TEST_IDENTICAL=${command}`,
      'UPLOAD_TEST_ENCRYPTED=encrypted:opaque-upload-token',
      'UPLOAD_TEST_INHERIT=$UPLOAD_TEST_EMPTY',
    ].join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_EMPTY).toBe('')
    expect(result.UPLOAD_TEST_IDENTICAL).toBe(command)
    expect(result.UPLOAD_TEST_ENCRYPTED).toBe('encrypted:opaque-upload-token')
    expect(result.UPLOAD_TEST_INHERIT).toBe('')
    expect(process.env.UPLOAD_TEST_IDENTICAL).toBe(command)
  })

  it('does not execute file commands when envDir is disabled', async () => {
    await writeFile(path.join(directory, '.env'), `UPLOAD_TEST_COMMAND=$("${process.execPath}" -e "process.exit(1)")`)

    expect((await loadUploadEnv(directory, 'production', undefined, false)).UPLOAD_TEST_COMMAND).toBeUndefined()
  })

  it.each(['process', 'file'])('decrypts credentials using a private key from %s', async (source) => {
    // 来自 @dotenvx/primitives README 的公开测试向量，不是真实上传凭据。
    const privateKey = 'bc0abbb65ae0929b0b492035c57bd742527ad5cc0bb4f28155b62ac8c41324c8'
    const encrypted = 'encrypted:BC6dAYLyWtegG6SE44mf5KFegS2Wx9nhmlHhmGki0N0TV3XDpSN4Lfpz1p/pYdIlD+8rmsLTUNyDABJsGADuoDsv8caHK8yifvRly8cN2Uz9kRWATHsg6eaJ3vNSUFrzqYfs3tcsT1w='
    const lines = [
      `UPLOAD_TEST_ENCRYPTED=${encrypted}`,
      'UPLOAD_TEST_DECRYPTED_REFERENCE=$UPLOAD_TEST_ENCRYPTED',
    ]
    if (source === 'process') {
      vi.stubEnv('DOTENV_PRIVATE_KEY', privateKey)
    }
    else {
      lines.unshift(`DOTENV_PRIVATE_KEY=${privateKey}`)
    }
    await writeFile(path.join(directory, '.env'), 'UPLOAD_TEST_DECRYPTED_REFERENCE=base')
    await writeFile(path.join(directory, '.env.production'), lines.join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_ENCRYPTED).toBe('Dotenvx')
    expect(result.UPLOAD_TEST_DECRYPTED_REFERENCE).toBe('Dotenvx')
    expect(process.env.UPLOAD_TEST_ENCRYPTED).toBeUndefined()
    expect(process.env.DOTENV_PRIVATE_KEY).toBe(source === 'process' ? privateKey : undefined)
  })

  it('rejects invalid encrypted credentials without modifying process values', async () => {
    vi.stubEnv('DOTENV_PRIVATE_KEY', 'invalid-private-key')
    await writeFile(path.join(directory, '.env'), 'UPLOAD_TEST_ENCRYPTED=encrypted:opaque-upload-token')

    await expect(loadUploadEnv(directory, 'production')).rejects.toThrow()
    expect(process.env.UPLOAD_TEST_ENCRYPTED).toBeUndefined()
  })

  it('expands multiple levels in dependency order without re-executing commands', async () => {
    await writeFile(path.join(directory, 'count.cjs'), [
      'const fs = require("node:fs")',
      'const path = require("node:path")',
      'fs.appendFileSync(path.join(__dirname, "calls.txt"), "called\\n")',
      'process.stdout.write("expanded")',
    ].join('\n'))
    await writeFile(path.join(directory, '.env'), 'UPLOAD_TEST_LEVEL_ONE=base\nUPLOAD_TEST_LEVEL_TWO=base')
    await writeFile(path.join(directory, '.env.production'), [
      `UPLOAD_TEST_SOURCE=$("${process.execPath}" "${path.join(directory, 'count.cjs')}")`,
      'UPLOAD_TEST_LEVEL_ONE=$UPLOAD_TEST_SOURCE',
      'UPLOAD_TEST_LEVEL_TWO=$UPLOAD_TEST_LEVEL_ONE',
    ].join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_SOURCE).toBe('expanded')
    expect(result.UPLOAD_TEST_LEVEL_ONE).toBe('expanded')
    expect(result.UPLOAD_TEST_LEVEL_TWO).toBe('expanded')
    expect(await readFile(path.join(directory, 'calls.txt'), 'utf8')).toBe('called\n')
  })

  it('distinguishes unset and empty values for default and alternate expansion', async () => {
    vi.stubEnv('UPLOAD_TEST_EMPTY', '')
    vi.stubEnv('UPLOAD_TEST_MISSING', undefined)
    await writeFile(path.join(directory, '.env'), [
      `UPLOAD_TEST_DEFAULT_UNSET=\${UPLOAD_TEST_MISSING-fallback}`,
      `UPLOAD_TEST_DEFAULT_EMPTY=\${UPLOAD_TEST_EMPTY-fallback}`,
      `UPLOAD_TEST_DEFAULT_COLON=\${UPLOAD_TEST_EMPTY:-fallback}`,
      `UPLOAD_TEST_ALTERNATE_UNSET=\${UPLOAD_TEST_MISSING+alternate}`,
      `UPLOAD_TEST_ALTERNATE_EMPTY=\${UPLOAD_TEST_EMPTY+alternate}`,
      `UPLOAD_TEST_ALTERNATE_COLON=\${UPLOAD_TEST_EMPTY:+alternate}`,
    ].join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_DEFAULT_UNSET).toBe('fallback')
    expect(result.UPLOAD_TEST_DEFAULT_EMPTY).toBe('')
    expect(result.UPLOAD_TEST_DEFAULT_COLON).toBe('fallback')
    expect(result.UPLOAD_TEST_ALTERNATE_UNSET).toBe('')
    expect(result.UPLOAD_TEST_ALTERNATE_EMPTY).toBe('alternate')
    expect(result.UPLOAD_TEST_ALTERNATE_COLON).toBe('')
  })

  it('preserves escaped dollar signs and expands default values', async () => {
    vi.stubEnv('UPLOAD_TEST_PROCESS', 'ci-secret')
    vi.stubEnv('UPLOAD_TEST_MISSING', undefined)
    await writeFile(path.join(directory, '.env'), [
      'UPLOAD_TEST_LITERAL=\\$UPLOAD_TEST_PROCESS',
      `UPLOAD_TEST_FALLBACK=\${UPLOAD_TEST_MISSING:-fallback-secret}`,
      `UPLOAD_TEST_DEFINED=\${UPLOAD_TEST_PROCESS:-fallback-secret}`,
    ].join('\n'))

    const result = await loadUploadEnv(directory, 'production')
    expect(result.UPLOAD_TEST_LITERAL).toBe('$UPLOAD_TEST_PROCESS')
    expect(result.UPLOAD_TEST_FALLBACK).toBe('fallback-secret')
    expect(result.UPLOAD_TEST_DEFINED).toBe('ci-secret')
  })
})
