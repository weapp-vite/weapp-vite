import type { ClientRequest } from 'node:http'
import https from 'node:https'

const REQUEST_TIMEOUT_MS = 5_000

function requestJson(packageName: string, suffix = '', signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}${suffix}`
    let request: ClientRequest | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false

    function finish(error?: unknown, value?: unknown) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      // eslint-disable-next-line ts/no-use-before-define
      signal?.removeEventListener('abort', abort)
      if (error) {
        reject(error)
      }
      else {
        resolve(value)
      }
    }

    function fail(error: unknown) {
      finish(error)
      request?.destroy(error instanceof Error ? error : new Error(String(error)))
    }

    function abort() {
      fail(signal?.reason ?? new Error(`Request to ${url} was aborted`))
    }

    if (signal?.aborted) {
      abort()
      return
    }

    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => fail(new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
    try {
      request = https.get(url, {
        headers: { Accept: 'application/vnd.npm.install-v1+json' },
      }, (response) => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          response.resume()
          fail(new Error(`Request to ${url} failed with status ${response.statusCode ?? 'unknown'}`))
          return
        }
        let data = ''
        response.setEncoding('utf8')
        response.on('data', chunk => (data += chunk))
        response.on('end', () => {
          try {
            finish(undefined, JSON.parse(data))
          }
          catch (error) {
            fail(error)
          }
        })
        response.on('error', fail)
        response.on('aborted', () => fail(new Error(`Response from ${url} was aborted`)))
      })
      request.on('error', fail)
    }
    catch (error) {
      fail(error)
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 从官方 npm registry 获取包的已发布版本列表。 */
export async function getPackageVersionsFromNpm(packageName: string, signal?: AbortSignal): Promise<string[]> {
  const metadata = await requestJson(packageName, '', signal)
  if (!isRecord(metadata) || !isRecord(metadata.versions)) {
    throw new Error(`Unexpected response when fetching ${packageName}: missing versions`)
  }
  return Object.keys(metadata.versions)
}

/** 从官方 npm registry 获取包的最新版本号。 */
export async function getLatestVersionFromNpm(packageName: string): Promise<string> {
  const metadata = await requestJson(packageName, '/latest')
  if (!isRecord(metadata) || typeof metadata.version !== 'string' || !metadata.version) {
    throw new Error(`Unexpected response when fetching ${packageName}: missing version`)
  }
  return metadata.version
}

export async function latestVersion(
  packageName: string,
  prefix: string = '^',
  fetch: typeof getLatestVersionFromNpm = getLatestVersionFromNpm,
) {
  try {
    const resolved = await fetch(packageName)
    return resolved ? `${prefix}${resolved}` : null
  }
  catch {
    return null
  }
}
