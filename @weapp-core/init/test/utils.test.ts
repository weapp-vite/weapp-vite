import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FsReadError,
  FsWriteError,
  readFileIfExists,
  readJsonIfExists,
  writeFile,
  writeJsonFile,
} from '@/utils/fs'
import { resolveOutputPath } from '@/utils/path'

describe('utils/fs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads json when present and returns null when missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-'))
    const jsonPath = path.join(root, 'data.json')
    await fs.outputJSON(jsonPath, { foo: 'bar' })

    expect(await readJsonIfExists(jsonPath)).toEqual({ foo: 'bar' })
    expect(await readJsonIfExists(path.join(root, 'missing.json'))).toBeNull()
  })

  it('wraps read errors with FsReadError', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-invalid-'))
    const invalidPath = path.join(root, 'invalid.json')
    await fs.outputFile(invalidPath, '{')

    await expect(readJsonIfExists(invalidPath)).rejects.toBeInstanceOf(FsReadError)
  })

  it('reads files and returns null when missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-file-'))
    const filePath = path.join(root, 'file.txt')
    await fs.outputFile(filePath, 'hello')

    expect(await readFileIfExists(filePath)).toBe('hello')
    expect(await readFileIfExists(path.join(root, 'missing.txt'))).toBeNull()
  })

  it('wraps file read errors', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-file-error-'))
    await fs.ensureDir(path.join(root, 'as-directory'))
    await expect(readFileIfExists(path.join(root, 'as-directory'))).rejects.toBeInstanceOf(FsReadError)
  })

  it('writes json and wraps failures', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-write-json-'))
    const filePath = path.join(root, 'data.json')
    await writeJsonFile(filePath, { a: 1 })
    expect(await fs.readJSON(filePath)).toEqual({ a: 1 })

    const badPath = path.join(root, 'file-as-dir', 'nested.json')
    await fs.outputFile(path.join(root, 'file-as-dir'), 'not a dir')
    await expect(writeJsonFile(badPath, {})).rejects.toBeInstanceOf(FsWriteError)
  })

  it('writes files and wraps failures', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-utils-write-file-'))
    const filePath = path.join(root, 'file.txt')
    await writeFile(filePath, 'content')
    expect(await fs.readFile(filePath, 'utf8')).toBe('content')

    const badPath = path.join(root, 'as-file', 'child.txt')
    await fs.outputFile(path.join(root, 'as-file'), 'not a dir')
    await expect(writeFile(badPath, 'next')).rejects.toBeInstanceOf(FsWriteError)
  })
})

describe('utils/path', () => {
  it('resolves output paths relative to root', () => {
    const resolved = resolveOutputPath('/root', 'nested/out.txt', '/root/out.txt')
    expect(resolved).toBe('/root/nested/out.txt')
  })

  it('returns fallback when dest is missing', () => {
    const fallback = resolveOutputPath('/root', undefined, '/root/out.txt')
    expect(fallback).toBe('/root/out.txt')
  })

  it('returns absolute dest untouched', () => {
    const dest = resolveOutputPath('/root', '/abs/out.txt', '/root/out.txt')
    expect(dest).toBe('/abs/out.txt')
  })
})
