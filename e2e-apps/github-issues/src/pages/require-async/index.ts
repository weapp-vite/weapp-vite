interface RequireAsyncResult {
  marker: string
  mode: 'callback' | 'promise'
  ok: boolean
}

function loadWithCallback() {
  return new Promise<RequireAsyncResult>((resolve) => {
    // 这里刻意覆盖微信小程序原生 callback 版 require API。
    // eslint-disable-next-line ts/no-require-imports
    require('../../subpackages/require-async/callback', (moduleExport) => {
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
  const moduleExport = await require.async('../../subpackages/require-async/promise')
  const marker = moduleExport.promiseMarker
  return {
    marker,
    mode: 'promise',
    ok: marker === 'require-async:promise',
  } satisfies RequireAsyncResult
}

Page({
  data: {
    status: 'ready',
  },
  async _runE2E(mode: 'callback' | 'promise') {
    return mode === 'callback'
      ? await loadWithCallback()
      : await loadWithPromise()
  },
})
