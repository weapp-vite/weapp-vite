import { encodeText } from './shared'

export interface MultipartFormDataPayload {
  body: ArrayBuffer
  contentType: string
}

type MultipartFormDataEntryValue = Blob | File | string | {
  readonly name?: string
  readonly size?: number
  readonly type?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}
type FormDataLike = Iterable<[string, MultipartFormDataEntryValue]>

const CRLF = '\r\n'

function createMultipartBoundary() {
  return `----weapp-vite-formdata-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function escapeMultipartName(value: string) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

function concatArrayBuffers(buffers: ArrayBuffer[]) {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }
  return merged.buffer
}

function isBlobFormDataValue(value: MultipartFormDataEntryValue): value is Exclude<MultipartFormDataEntryValue, string> {
  return typeof value !== 'string' && typeof value?.arrayBuffer === 'function'
}

function getMultipartFilename(value: Exclude<MultipartFormDataEntryValue, string>) {
  const name = (value as { name?: unknown }).name
  return typeof name === 'string' && name.length > 0 ? name : 'blob'
}

async function createMultipartPart(name: string, value: MultipartFormDataEntryValue) {
  if (!isBlobFormDataValue(value)) {
    return [
      encodeText(`Content-Disposition: form-data; name="${escapeMultipartName(name)}"${CRLF}${CRLF}`),
      encodeText(String(value)),
      encodeText(CRLF),
    ]
  }

  const filename = getMultipartFilename(value)
  const headers = [
    `Content-Disposition: form-data; name="${escapeMultipartName(name)}"; filename="${escapeMultipartName(filename)}"`,
    `Content-Type: ${value.type || 'application/octet-stream'}`,
    '',
    '',
  ].join(CRLF)

  return [
    encodeText(headers),
    await value.arrayBuffer(),
    encodeText(CRLF),
  ]
}

export async function encodeMultipartFormData(formData: FormDataLike): Promise<MultipartFormDataPayload> {
  const boundary = createMultipartBoundary()
  const buffers: ArrayBuffer[] = []

  for (const [name, value] of formData) {
    buffers.push(encodeText(`--${boundary}${CRLF}`))
    buffers.push(...await createMultipartPart(name, value))
  }

  buffers.push(encodeText(`--${boundary}--${CRLF}`))

  return {
    body: concatArrayBuffers(buffers),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}
