import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUploadEnv } from './env'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-env-'))
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
})
