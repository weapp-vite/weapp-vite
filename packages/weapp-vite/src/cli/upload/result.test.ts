import type { UploadContext } from './types'
import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validatePreviewResult } from './result'

let context: UploadContext
beforeEach(async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-preview-result-'))
  context = { cwd, projectPath: cwd, version: '', desc: '', env: {}, qrCodePath: path.join(cwd, 'current.png') }
})
afterEach(async () => {
  await rm(context.cwd, { recursive: true, force: true })
})

describe('preview result boundary', () => {
  it('does not turn an empty SDK success into a completed preview', async () => {
    await expect(validatePreviewResult(undefined, context)).rejects.toThrow()
    await expect(validatePreviewResult({ version: '1.0.0' }, context)).rejects.toThrow()
    await expect(validatePreviewResult({ qrCodeUrl: '' }, context)).rejects.toThrow()
  })

  it('rejects credential-bearing or executable links', async () => {
    await expect(validatePreviewResult({ qrCodeUrl: 'https://user:password@example.test/qr' }, context)).rejects.toThrow()
    await expect(validatePreviewResult({ previewUrl: 'javascript:alert(1)' }, context)).rejects.toThrow()
    await expect(validatePreviewResult({ qrCodeUrl: 'sslocal://microapp' }, context)).rejects.toThrow()
  })

  it('accepts a preview destination but excludes unrelated SDK metadata', async () => {
    expect(await validatePreviewResult({ previewUrl: 'sslocal://microapp?app_id=fixture', token: 'private', version: '1.0.0' }, context))
      .toEqual({ previewUrl: 'sslocal://microapp?app_id=fixture' })
  })

  it('rejects missing, empty, or previous-run files instead of displaying a stale QR', async () => {
    await expect(validatePreviewResult({ qrCodeFile: context.qrCodePath }, context)).rejects.toThrow()
    await writeFile(context.qrCodePath!, '')
    await expect(validatePreviewResult({ qrCodeFile: context.qrCodePath }, context)).rejects.toThrow()
    const previous = path.join(context.cwd, 'previous.png')
    await writeFile(previous, Buffer.from([137, 80, 78, 71]))
    await expect(validatePreviewResult({ qrCodeFile: previous }, context)).rejects.toThrow()
  })
})
