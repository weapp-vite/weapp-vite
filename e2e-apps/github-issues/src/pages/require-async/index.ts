interface RequireAsyncResult {
  marker: string
  mode: 'callback' | 'native' | 'promise'
  ok: boolean
}

function loadWithCallback() {
  return new Promise<RequireAsyncResult>((resolve) => {
    // 这里刻意覆盖微信小程序原生 callback 版 require API。
    // eslint-disable-next-line ts/no-require-imports
    require('../../subpackages/require-async/callback.ts', (moduleExport) => {
      const marker = moduleExport.callbackMarker
      resolve({
        marker,
        mode: 'callback',
        ok: marker === 'require-async:callback',
      })
    }, (error) => {
      resolve({
        marker: String(error?.errMsg ?? error),
        mode: 'callback',
        ok: false,
      })
    })
  })
}

async function loadWithPromise() {
  const moduleExport = await require.async('../../subpackages/require-async/promise.ts')
  const marker = moduleExport.promiseMarker
  return {
    marker,
    mode: 'promise',
    ok: marker === 'require-async:promise',
  } satisfies RequireAsyncResult
}

async function loadWithNativeImport() {
  const moduleExport = await import('../../subpackages/require-async/import-native.ts')
  const marker = `${moduleExport.default}:${moduleExport.nativeMarker}:${moduleExport.transitiveMarker}`
  return {
    marker,
    mode: 'native',
    ok: Boolean(moduleExport.default && moduleExport.nativeMarker && moduleExport.transitiveMarker),
  } satisfies RequireAsyncResult
}

Page({
  data: {
    status: 'ready',
  },
  async _runE2E(mode: 'callback' | 'native' | 'promise') {
    if (mode === 'callback') {
      return await loadWithCallback()
    }
    if (mode === 'native') {
      return await loadWithNativeImport()
    }
    return await loadWithPromise()
  },
})
