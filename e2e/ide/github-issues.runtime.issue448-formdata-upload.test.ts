import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const LOCAL_SERVER_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted/i,
  /EACCES/i,
]

let baseUrl = ''
let serverHandle: Awaited<ReturnType<typeof startRequestClientsRealServer>> | null = null
let sharedInfraUnavailableMessage = ''

function isLocalServerInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return LOCAL_SERVER_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function withBaseUrl(route: string) {
  return `${route}?baseUrl=${encodeURIComponent(baseUrl)}`
}

describe.sequential('github-issues runtime issue #448 FormData upload', () => {
  beforeAll(async () => {
    try {
      serverHandle = await startRequestClientsRealServer()
      baseUrl = serverHandle.baseUrl
    }
    catch (error) {
      if (isLocalServerInfraError(error)) {
        sharedInfraUnavailableMessage = '本地测试服务基础设施不可用，跳过 issue-448 FormData 上传 IDE 自动化用例。'
        return
      }
      throw error
    }

    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
    if (serverHandle) {
      await serverHandle.stop()
    }
  })

  it('uploads wx.downloadFile data as Blob, File, and Request FormData bodies in real DevTools', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(
        miniProgram,
        withBaseUrl('/pages/issue-448/index'),
        'issue448-page',
        30_000,
      )
      if (!page) {
        throw new Error('Failed to launch issue-448 page')
      }

      const result = await page.callMethod('_runFormDataUploadE2E')
      const runtime = await page.callMethod('_runE2E')
      const rawFetch = result?.payload?.rawFetch ?? []

      expect(result?.ok, JSON.stringify({ result, requestCounts: serverHandle?.requestCounts })).toBe(true)
      expect(result?.status).toBe('passed')
      expect(rawFetch.map((item: { caseName: string }) => item.caseName)).toEqual([
        'arraybuffer-init',
        'uint8array-init',
        'dataview-init',
        'blob-init',
        'file-init',
        'blob-like-init',
        'arraybuffer-request',
        'blob-request',
        'blob-like-request',
      ])
      expect(result?.payload?.blob).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-blob.bin',
        name: 'blob-file',
      })
      expect(result?.payload?.file).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-file.bin',
        name: 'file-file',
      })
      expect(result?.payload?.request).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-request.bin',
        name: 'request-file',
      })
      expect(result?.payload?.blob?.sha256).toBe(result?.payload?.expectedSha256)
      expect(result?.payload?.file?.sha256).toBe(result?.payload?.expectedSha256)
      expect(result?.payload?.request?.sha256).toBe(result?.payload?.expectedSha256)
      expect(result?.payload?.blob?.size).toBeGreaterThan(0)
      expect(result?.payload?.file?.size).toBe(result?.payload?.blob?.size)
      expect(result?.payload?.request?.size).toBe(result?.payload?.blob?.size)
      expect(result?.payload?.readKind).toBe('arraybuffer')
      for (const item of rawFetch) {
        expect(item.sha256).toBe(item.expectedSha256)
        expect(item.size).toBe(result?.payload?.blob?.size)
      }
      expect(rawFetch.find((item: { caseName: string }) => item.caseName === 'blob-init')?.contentType).toBe('application/octet-stream')
      expect(rawFetch.find((item: { caseName: string }) => item.caseName === 'file-init')?.contentType).toBe('application/octet-stream')
      expect(rawFetch.find((item: { caseName: string }) => item.caseName === 'blob-like-init')?.contentType).toBe('application/octet-stream')
      expect(rawFetch.find((item: { caseName: string }) => item.caseName === 'blob-request')?.contentType).toBe('application/octet-stream')
      expect(rawFetch.find((item: { caseName: string }) => item.caseName === 'blob-like-request')?.contentType).toBe('application/octet-stream')
      expect(runtime.formDataUploadStatus).toBe('passed')
      expect(runtime.rawFetchUploadStatus).toBe('passed')
      expect(runtime.formDataReadKind).toBe('arraybuffer')
      expect(runtime.formDataUploadPayload).toContain('downloaded-blob.bin')
      expect(runtime.formDataUploadPayload).toContain('downloaded-file.bin')
      expect(runtime.formDataUploadPayload).toContain('downloaded-request.bin')
      expect(runtime.rawFetchUploadPayload).toContain('arraybuffer-init')
      expect(runtime.rawFetchUploadPayload).toContain('blob-request')
      expect(serverHandle?.requestCounts.formDataUpload).toBe(3)
      expect(serverHandle?.requestCounts.rawUpload).toBe(9)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
