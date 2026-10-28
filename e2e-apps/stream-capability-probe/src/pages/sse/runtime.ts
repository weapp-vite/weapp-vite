import { installWebRuntimeGlobals } from '@wevu/web-apis'

// 此副作用模块先于第三方 parser 求值；原生探针页面不加载此模块。
installWebRuntimeGlobals({
  targets: ['fetch', 'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal', 'ReadableStream', 'WritableStream', 'TransformStream', 'TextDecoder', 'TextDecoderStream', 'EventSource'],
  networkDefaults: { request: { enableChunked: true } },
})
