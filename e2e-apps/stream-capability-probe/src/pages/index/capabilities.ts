interface ProbeResult { available: boolean, works: boolean, detail: string }
/** 只读取当前宿主，不导入或安装任何 Web API 兼容层。 */
export async function probeCapabilities() {
  const host = globalThis as Record<string, any>
  async function probe(name: string, run: () => unknown): Promise<ProbeResult> {
    if (typeof host[name] !== 'function') {
      return { available: false, works: false, detail: 'missing' }
    }
    try {
      return { available: true, works: Boolean(await run()), detail: 'observed' }
    }
    catch (error) {
      return { available: true, works: false, detail: String(error) }
    }
  }
  const readableStream = await probe('ReadableStream', async () => {
    const stream = new host.ReadableStream({ start(controller: any) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } })
    const reader = stream.getReader()
    return (await reader.read()).value[0] === 65 && (await reader.read()).done
  })
  const textDecoder = await probe('TextDecoder', () => {
    const decoder = new host.TextDecoder()
    return decoder.decode(new Uint8Array([0xE4]), { stream: true }) === ''
      && decoder.decode(new Uint8Array([0xB8, 0xAD, 0xF0, 0x9F]), { stream: true }) === '中'
      && decoder.decode(new Uint8Array([0x99, 0x82])) === '🙂'
  })
  const blobStream = await probe('Blob', async () => {
    const blob = new host.Blob([new Uint8Array([65])])
    if (typeof blob.stream !== 'function') {
      return false
    }
    const reader = blob.stream().getReader()
    return (await reader.read()).value[0] === 65 && (await reader.read()).done
  })
  const info = wx.getSystemInfoSync()
  return { readableStream, textDecoder, blobStream, environment: { SDKVersion: info.SDKVersion, platform: info.platform, version: info.version, system: info.system, renderer: 'webview' } }
}
