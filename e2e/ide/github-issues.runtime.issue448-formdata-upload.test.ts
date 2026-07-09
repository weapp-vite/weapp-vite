import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'
import {
  callRoutePageMethod,
  callRoutePageMethodWithOptions,
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
  }, 30_000)

  it('uploads wx.downloadFile data as Blob, File, and Request FormData bodies in real DevTools', async (ctx) => {
    if (sharedInfraUnavailableMessage) {
      ctx.skip(sharedInfraUnavailableMessage)
    }

    const miniProgram = await getSharedMiniProgram(ctx)
    const route = withBaseUrl('/pages/issue-448/index')
    try {
      const page = await relaunchPage(
        miniProgram,
        route,
        undefined,
        30_000,
        {
          readiness: async page => Boolean(await page.waitForRendered({
            dataset: {
              baseUrl,
              e2eIssue: '448',
            },
            selector: '#issue448-page',
            timeout: 15_000,
          })),
        },
      )
      if (!page) {
        throw new Error('Failed to launch issue-448 page')
      }

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const started = await callRoutePageMethodWithOptions(activeMiniProgram, route, '_startFormDataUploadE2E', {
        protocolTimeoutMs: 12_000,
        retries: 1,
      })
      expect(started?.ok).toBe(true)
      await expect(page.waitForRendered({
        dataset: {
          formDataStatus: 'passed',
          rawFetchStatus: 'passed',
          readKind: 'arraybuffer',
        },
        selector: '.issue448-upload-probe',
        timeout: 90_000,
      })).resolves.toBeTruthy()
      const runtime = await callRoutePageMethod(activeMiniProgram, route, '_runE2E')
      const payload = JSON.parse(runtime.formDataUploadPayload)
      const rawFetch = JSON.parse(runtime.rawFetchUploadPayload)

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
      expect(payload?.blob).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-blob.bin',
        name: 'blob-file',
      })
      expect(payload?.file).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-file.bin',
        name: 'file-file',
      })
      expect(payload?.request).toMatchObject({
        contentType: 'application/octet-stream',
        filename: 'downloaded-request.bin',
        name: 'request-file',
      })
      expect(payload?.blob?.sha256).toBe(payload?.expectedSha256)
      expect(payload?.file?.sha256).toBe(payload?.expectedSha256)
      expect(payload?.request?.sha256).toBe(payload?.expectedSha256)
      expect(payload?.blob?.size).toBeGreaterThan(0)
      expect(payload?.file?.size).toBe(payload?.blob?.size)
      expect(payload?.request?.size).toBe(payload?.blob?.size)
      expect(payload?.readKind).toBe('arraybuffer')
      for (const item of rawFetch) {
        expect(item.sha256).toBe(item.expectedSha256)
        expect(item.size).toBe(payload?.blob?.size)
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
