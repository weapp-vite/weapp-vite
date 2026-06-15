import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'

const ISSUE_448_FIXTURE = Buffer.from([
  0x00,
  0x01,
  0x02,
  0x03,
  ...Buffer.from('issue-448-formdata-upload'),
  0xF0,
  0x9F,
  0x94,
  0xA5,
  0xFF,
])
const ISSUE_448_FIXTURE_SHA256 = createHash('sha256').update(ISSUE_448_FIXTURE).digest('hex')

function createMultipartBody(boundary: string) {
  const chunks = [
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="file.bin"\r\n'),
    Buffer.from('Content-Type: application/octet-stream\r\n\r\n'),
    ISSUE_448_FIXTURE,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]
  return Buffer.concat(chunks)
}

describe('requestClientsRealServer issue #448 binary upload endpoints', () => {
  it('checks raw and multipart binary upload payloads by server-side sha256', async () => {
    const handle = await startRequestClientsRealServer()

    try {
      const rawResponse = await fetch(`${handle.baseUrl}/issue-448/raw-upload`, {
        body: ISSUE_448_FIXTURE,
        headers: {
          'content-type': 'application/octet-stream',
        },
        method: 'POST',
      })
      const rawPayload = await rawResponse.json() as {
        contentType: string
        expectedSha256: string
        sha256: string
        size: number
      }

      expect(rawPayload.contentType).toBe('application/octet-stream')
      expect(rawPayload.expectedSha256).toBe(ISSUE_448_FIXTURE_SHA256)
      expect(rawPayload.sha256).toBe(ISSUE_448_FIXTURE_SHA256)
      expect(rawPayload.size).toBe(ISSUE_448_FIXTURE.byteLength)

      const boundary = '----issue-448-server-e2e-boundary'
      const multipartResponse = await fetch(`${handle.baseUrl}/issue-448/upload`, {
        body: createMultipartBody(boundary),
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        method: 'POST',
      })
      const multipartPayload = await multipartResponse.json() as {
        expectedSha256: string
        files: Array<{
          contentType: string
          filename: string
          name: string
          sha256: string
          size: number
        }>
      }

      expect(multipartPayload.expectedSha256).toBe(ISSUE_448_FIXTURE_SHA256)
      expect(multipartPayload.files).toEqual([
        {
          contentType: 'application/octet-stream',
          filename: 'file.bin',
          name: 'file',
          sha256: ISSUE_448_FIXTURE_SHA256,
          size: ISSUE_448_FIXTURE.byteLength,
        },
      ])
      expect(handle.requestCounts.rawUpload).toBe(1)
      expect(handle.requestCounts.formDataUpload).toBe(1)
    }
    finally {
      await handle.stop()
    }
  })
})
