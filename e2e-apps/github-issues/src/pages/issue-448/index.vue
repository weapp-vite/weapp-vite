<script setup lang="ts">
import { onLoad, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-448',
})

definePageMeta({
  layout: false,
})

const encoded = btoa('AB')
const decoded = atob(encoded)
const duration = Number(performance.now().toFixed(2))
const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(4))).join(',')
const eventType = new Event('tick').type
const customEventType = new CustomEvent('payload', {
  detail: {
    ok: true,
  },
}).type
const parsedUrl = URL.parse('/next?b=2&a=1', 'https://issue-448.invalid/base/')
const canParseUrl = URL.canParse('/next', 'https://issue-448.invalid')
const searchParams = new URLSearchParams('b=2&a=1&a=0')
const searchParamsSize = searchParams.size
searchParams.sort()
const sortedParams = searchParams.toString()
const headers = new Headers()
headers.append('Set-Cookie', 'session=issue-448')
headers.append('Set-Cookie', 'theme=dark')
const cookieCount = headers.getSetCookie().length
const jsonResponse = Response.json({ ok: true })
const jsonResponseContentType = jsonResponse.headers.get('content-type')
const errorResponse = Response.error()
const microtaskState = ref('pending')
const baseUrl = ref('')
const formDataUploadStatus = ref('idle')
const formDataUploadPayload = ref('')
const formDataReadKind = ref('')

queueMicrotask(() => {
  microtaskState.value = 'flushed'
})

interface DownloadFileSuccessResult {
  statusCode?: number
  tempFilePath: string
}

interface MultipartUploadFileResult {
  contentType: string
  filename: string
  name: string
  sha256: string
  size: number
}

interface MultipartUploadPayload {
  expectedSha256: string
  files: MultipartUploadFileResult[]
  path: string
}

type UploadFormDataInput = Parameters<typeof fetch>[0]
type UploadFormDataInit = Parameters<typeof fetch>[1]

interface Issue448WxApi {
  downloadFile: (options: {
    fail?: (error: unknown) => void
    success?: (result: DownloadFileSuccessResult) => void
    url: string
  }) => void
  getFileSystemManager: () => {
    readFile: (options: {
      fail?: (error: unknown) => void
      filePath: string
      success?: (result: { data: string | ArrayBuffer }) => void
    }) => void
  }
}

const wxApi = (globalThis as unknown as { wx: Issue448WxApi }).wx

function resolveBaseUrl(query: Record<string, unknown> | undefined) {
  return typeof query?.baseUrl === 'string' ? decodeURIComponent(query.baseUrl) : ''
}

function downloadFile(url: string) {
  return new Promise<DownloadFileSuccessResult>((resolve, reject) => {
    wxApi.downloadFile({
      fail: reject,
      success: resolve,
      url,
    })
  })
}

function readDownloadedFile(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    wxApi.getFileSystemManager().readFile({
      fail: reject,
      filePath,
      success(result) {
        if (typeof result.data === 'string') {
          formDataReadKind.value = 'string'
          const bytes = new Uint8Array(result.data.length)
          for (let index = 0; index < result.data.length; index++) {
            bytes[index] = result.data.charCodeAt(index) & 0xFF
          }
          resolve(bytes.buffer)
          return
        }
        formDataReadKind.value = 'arraybuffer'
        resolve(result.data)
      },
    })
  })
}

function assertUploadPayload(payload: MultipartUploadPayload, expectedNames: string[]) {
  if (payload.path !== '/issue-448/upload') {
    throw new Error(`unexpected upload path: ${payload.path}`)
  }

  for (const expectedName of expectedNames) {
    const file = payload.files.find(item => item.name === expectedName)
    if (!file) {
      throw new Error(`missing upload file: ${expectedName}`)
    }
    if (file.sha256 !== payload.expectedSha256) {
      throw new Error(`unexpected ${expectedName} sha256: ${file.sha256}, size: ${file.size}`)
    }
    if (file.size <= 0) {
      throw new Error(`unexpected ${expectedName} size: ${file.size}`)
    }
  }
}

async function uploadFormData(input: UploadFormDataInput, init?: UploadFormDataInit) {
  const response = await fetch(input, init)
  return await response.json() as MultipartUploadPayload
}

async function uploadDownloadedFileAsFormData() {
  if (!baseUrl.value) {
    throw new Error('missing issue-448 baseUrl')
  }

  formDataUploadStatus.value = 'running'
  const download = await downloadFile(`${baseUrl.value}/issue-448/download.bin`)
  if (download.statusCode && download.statusCode !== 200) {
    throw new Error(`downloadFile failed with status ${download.statusCode}`)
  }

  const buffer = await readDownloadedFile(download.tempFilePath)
  const blobFormData = new FormData()
  blobFormData.append('blob-file', new Blob([buffer], { type: 'application/octet-stream' }), 'downloaded-blob.bin')
  const blobPayload = await uploadFormData(`${baseUrl.value}/issue-448/upload`, {
    body: blobFormData,
    method: 'POST',
  })
  assertUploadPayload(blobPayload, ['blob-file'])

  const fileFormData = new FormData()
  fileFormData.append('file-file', new File([buffer], 'downloaded-file.bin', { type: 'application/octet-stream' }))
  const filePayload = await uploadFormData(`${baseUrl.value}/issue-448/upload`, {
    body: fileFormData,
    method: 'POST',
  })
  assertUploadPayload(filePayload, ['file-file'])

  const requestFormData = new FormData()
  requestFormData.append('request-file', new File([buffer], 'downloaded-request.bin', { type: 'application/octet-stream' }))
  const requestPayload = await uploadFormData(new Request(`${baseUrl.value}/issue-448/upload`, {
    body: requestFormData,
    method: 'POST',
  }))
  assertUploadPayload(requestPayload, ['request-file'])

  const payload = {
    blob: blobPayload.files.find(item => item.name === 'blob-file'),
    expectedSha256: blobPayload.expectedSha256,
    file: filePayload.files.find(item => item.name === 'file-file'),
    readKind: formDataReadKind.value,
    request: requestPayload.files.find(item => item.name === 'request-file'),
  }
  formDataUploadPayload.value = JSON.stringify(payload)
  formDataUploadStatus.value = 'passed'
  return payload
}

async function _runFormDataUploadE2E() {
  try {
    const payload = await uploadDownloadedFileAsFormData()
    return {
      ok: true,
      payload,
      status: formDataUploadStatus.value,
    }
  }
  catch (error) {
    formDataUploadStatus.value = 'failed'
    formDataUploadPayload.value = error instanceof Error ? error.message : String(error)
    return {
      error: formDataUploadPayload.value,
      ok: false,
      status: formDataUploadStatus.value,
    }
  }
}

onLoad((query) => {
  baseUrl.value = resolveBaseUrl(query)
})

function _runE2E() {
  return {
    baseUrl: baseUrl.value,
    encoded,
    decoded,
    duration,
    randomBytes,
    eventType,
    customEventType,
    parsedUrl: parsedUrl?.href,
    canParseUrl,
    searchParamsSize,
    sortedParams,
    cookieCount,
    jsonResponseContentType,
    errorResponseStatus: errorResponse.status,
    errorResponseType: errorResponse.type,
    formDataUploadPayload: formDataUploadPayload.value,
    formDataUploadStatus: formDataUploadStatus.value,
    formDataReadKind: formDataReadKind.value,
    microtaskState: microtaskState.value,
  }
}
</script>

<template>
  <view class="issue448-page">
    <text class="issue448-title">issue-448 next web runtime globals</text>
    <text class="issue448-line">encoded = {{ encoded }}</text>
    <text class="issue448-line">decoded = {{ decoded }}</text>
    <text class="issue448-line">duration = {{ duration }}</text>
    <text class="issue448-line">random = {{ randomBytes }}</text>
    <text class="issue448-line">event = {{ eventType }}</text>
    <text class="issue448-line">custom = {{ customEventType }}</text>
    <text class="issue448-line">url = {{ parsedUrl?.href }}</text>
    <text class="issue448-line">canParse = {{ canParseUrl }}</text>
    <text class="issue448-line">params = {{ sortedParams }}</text>
    <text class="issue448-line">cookies = {{ cookieCount }}</text>
    <text class="issue448-line">json = {{ jsonResponseContentType }}</text>
    <text class="issue448-line">error = {{ errorResponseStatus }}:{{ errorResponseType }}</text>
    <text class="issue448-line">read = {{ formDataReadKind }}</text>
    <text class="issue448-line">upload = {{ formDataUploadStatus }}</text>
    <text class="issue448-line">uploadPayload = {{ formDataUploadPayload }}</text>
    <text class="issue448-line">microtask = {{ microtaskState }}</text>
  </view>
</template>

<style scoped>
.issue448-page {
  padding: 32rpx;
}

.issue448-title,
.issue448-line {
  display: block;
  margin-bottom: 24rpx;
}
</style>
