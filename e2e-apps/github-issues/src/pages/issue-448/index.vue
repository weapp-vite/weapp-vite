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
const parsedUrlHref = URL.parse('/next?b=2&a=1', 'https://issue-448.invalid/base/')?.href
const canParseUrl = URL.canParse('/next', 'https://issue-448.invalid')
const { searchParamsSize, sortedParams } = (() => {
  const searchParams = new URLSearchParams('b=2&a=1&a=0')
  const size = searchParams.size
  searchParams.sort()
  return {
    searchParamsSize: size,
    sortedParams: searchParams.toString(),
  }
})()
const cookieCount = (() => {
  const headers = new Headers()
  headers.append('Set-Cookie', 'session=issue-448')
  headers.append('Set-Cookie', 'theme=dark')
  return headers.getSetCookie().length
})()
const jsonResponseContentType = Response.json({ ok: true }).headers.get('content-type')
const { errorResponseStatus, errorResponseType } = (() => {
  const response = Response.error()
  return {
    errorResponseStatus: response.status,
    errorResponseType: response.type,
  }
})()
const microtaskState = ref('pending')
const baseUrl = ref('')
const formDataUploadStatus = ref('idle')
const formDataUploadPayload = ref('')
const rawFetchUploadStatus = ref('idle')
const rawFetchUploadPayload = ref('')
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

interface RawFetchUploadPayload {
  contentType: string
  expectedSha256: string
  path: string
  sha256: string
  size: number
}

interface BlobLikeBody {
  readonly size: number
  readonly type: string
  arrayBuffer: () => Promise<ArrayBuffer>
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

function resolveBaseUrl(query: Record<string, unknown> | undefined) {
  return typeof query?.baseUrl === 'string' ? decodeURIComponent(query.baseUrl) : ''
}

function getWxApi() {
  return (globalThis as unknown as { wx: Issue448WxApi }).wx
}

function downloadFile(url: string) {
  return new Promise<DownloadFileSuccessResult>((resolve, reject) => {
    getWxApi().downloadFile({
      fail: reject,
      success: resolve,
      url,
    })
  })
}

function readDownloadedFile(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    getWxApi().getFileSystemManager().readFile({
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

function assertRawUploadPayload(caseName: string, payload: RawFetchUploadPayload) {
  if (payload.path !== '/issue-448/raw-upload') {
    throw new Error(`unexpected raw upload path for ${caseName}: ${payload.path}`)
  }
  if (payload.sha256 !== payload.expectedSha256) {
    throw new Error(`unexpected raw upload sha256 for ${caseName}: ${payload.sha256}, size: ${payload.size}`)
  }
  if (payload.size <= 0) {
    throw new Error(`unexpected raw upload size for ${caseName}: ${payload.size}`)
  }
}

async function uploadRawFetchCase(caseName: string, input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  const response = await fetch(input, init)
  const payload = await response.json() as RawFetchUploadPayload
  assertRawUploadPayload(caseName, payload)
  return {
    ...payload,
    caseName,
  }
}

function createBlobLikeBody(buffer: ArrayBuffer): BlobLikeBody {
  return {
    size: buffer.byteLength,
    type: 'application/octet-stream',
    async arrayBuffer() {
      return buffer.slice(0)
    },
  }
}

async function uploadDownloadedFileAsRawFetch(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const blobLikeBody = createBlobLikeBody(buffer)
  const url = `${baseUrl.value}/issue-448/raw-upload`
  const cases = [
    await uploadRawFetchCase('arraybuffer-init', url, {
      body: buffer,
      method: 'POST',
    }),
    await uploadRawFetchCase('uint8array-init', url, {
      body: bytes,
      method: 'POST',
    }),
    await uploadRawFetchCase('dataview-init', url, {
      body: view,
      method: 'POST',
    }),
    await uploadRawFetchCase('blob-init', url, {
      body: new Blob([buffer], { type: 'application/octet-stream' }),
      method: 'POST',
    }),
    await uploadRawFetchCase('file-init', url, {
      body: new File([buffer], 'raw-file.bin', { type: 'application/octet-stream' }),
      method: 'POST',
    }),
    await uploadRawFetchCase('blob-like-init', url, {
      body: blobLikeBody as BodyInit,
      method: 'POST',
    }),
    await uploadRawFetchCase('arraybuffer-request', new Request(url, {
      body: buffer,
      method: 'POST',
    })),
    await uploadRawFetchCase('blob-request', new Request(url, {
      body: new Blob([buffer], { type: 'application/octet-stream' }),
      method: 'POST',
    })),
    await uploadRawFetchCase('blob-like-request', new Request(url, {
      body: blobLikeBody as BodyInit,
      method: 'POST',
    })),
  ]
  return cases
}

async function uploadDownloadedFileAsFormData() {
  if (!baseUrl.value) {
    throw new Error('missing issue-448 baseUrl')
  }

  formDataUploadStatus.value = 'running'
  rawFetchUploadStatus.value = 'running'
  const download = await downloadFile(`${baseUrl.value}/issue-448/download.bin`)
  if (download.statusCode && download.statusCode !== 200) {
    throw new Error(`downloadFile failed with status ${download.statusCode}`)
  }

  const buffer = await readDownloadedFile(download.tempFilePath)
  const rawFetchPayload = await uploadDownloadedFileAsRawFetch(buffer)

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
    rawFetch: rawFetchPayload,
  }
  rawFetchUploadPayload.value = JSON.stringify(rawFetchPayload)
  rawFetchUploadStatus.value = 'passed'
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
    rawFetchUploadStatus.value = 'failed'
    formDataUploadPayload.value = error instanceof Error ? error.message : String(error)
    rawFetchUploadPayload.value = formDataUploadPayload.value
    return {
      error: formDataUploadPayload.value,
      ok: false,
      status: formDataUploadStatus.value,
    }
  }
}

let formDataUploadTask: Promise<unknown> | null = null

function _startFormDataUploadE2E() {
  if (!formDataUploadTask) {
    formDataUploadTask = _runFormDataUploadE2E()
    void formDataUploadTask.catch(() => {})
  }
  return {
    ok: true,
    status: formDataUploadStatus.value,
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
    parsedUrl: parsedUrlHref,
    canParseUrl,
    searchParamsSize,
    sortedParams,
    cookieCount,
    jsonResponseContentType,
    errorResponseStatus,
    errorResponseType,
    formDataUploadPayload: formDataUploadPayload.value,
    formDataUploadStatus: formDataUploadStatus.value,
    formDataReadKind: formDataReadKind.value,
    rawFetchUploadPayload: rawFetchUploadPayload.value,
    rawFetchUploadStatus: rawFetchUploadStatus.value,
    microtaskState: microtaskState.value,
  }
}
</script>

<template>
  <view
    id="issue448-page"
    class="issue448-page"
    :data-base-url="baseUrl"
    data-e2e-issue="448"
  >
    <text class="issue448-title">issue-448 next web runtime globals</text>
    <text class="issue448-line">encoded = {{ encoded }}</text>
    <text class="issue448-line">decoded = {{ decoded }}</text>
    <text class="issue448-line">duration = {{ duration }}</text>
    <text class="issue448-line">random = {{ randomBytes }}</text>
    <text class="issue448-line">event = {{ eventType }}</text>
    <text class="issue448-line">custom = {{ customEventType }}</text>
    <text class="issue448-line">url = {{ parsedUrlHref }}</text>
    <text class="issue448-line">canParse = {{ canParseUrl }}</text>
    <text class="issue448-line">params = {{ sortedParams }}</text>
    <text class="issue448-line">cookies = {{ cookieCount }}</text>
    <text class="issue448-line">json = {{ jsonResponseContentType }}</text>
    <text class="issue448-line">error = {{ errorResponseStatus }}:{{ errorResponseType }}</text>
    <text class="issue448-line">read = {{ formDataReadKind }}</text>
    <text class="issue448-line">upload = {{ formDataUploadStatus }}</text>
    <text class="issue448-line">uploadPayload = {{ formDataUploadPayload }}</text>
    <text class="issue448-line">rawFetch = {{ rawFetchUploadStatus }}</text>
    <text class="issue448-line">rawFetchPayload = {{ rawFetchUploadPayload }}</text>
    <text class="issue448-line">microtask = {{ microtaskState }}</text>
    <view
      class="issue448-upload-probe"
      :data-form-data-status="formDataUploadStatus"
      :data-raw-fetch-status="rawFetchUploadStatus"
      :data-read-kind="formDataReadKind"
    />
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
