import { ReadableStreamPolyfill } from '../streams'

export function isPonyfillStream(value: unknown): boolean {
  return value instanceof ReadableStreamPolyfill
}

/**
 * web-streams-polyfill 固定为 4.3.0；其公共 API 未提供 disturbed 查询，因此将版本相关读取限制在此处。
 * 品牌与字段形状必须同时匹配；升级依赖时由包版本测试和消费状态回归共同阻止静默漂移。
 */
export function isPonyfillStreamDisturbed(stream: ReadableStream) {
  if (!isPonyfillStream(stream)) {
    throw new TypeError('Expected a web-streams-polyfill ReadableStream')
  }
  const disturbed: unknown = Reflect.get(stream, '_disturbed')
  if (typeof disturbed !== 'boolean') {
    throw new TypeError('Unsupported web-streams-polyfill state layout; expected version 4.3.0')
  }
  return disturbed
}
