const constants = [
  0x428A2F98,
  0x71374491,
  0xB5C0FBCF,
  0xE9B5DBA5,
  0x3956C25B,
  0x59F111F1,
  0x923F82A4,
  0xAB1C5ED5,
  0xD807AA98,
  0x12835B01,
  0x243185BE,
  0x550C7DC3,
  0x72BE5D74,
  0x80DEB1FE,
  0x9BDC06A7,
  0xC19BF174,
  0xE49B69C1,
  0xEFBE4786,
  0x0FC19DC6,
  0x240CA1CC,
  0x2DE92C6F,
  0x4A7484AA,
  0x5CB0A9DC,
  0x76F988DA,
  0x983E5152,
  0xA831C66D,
  0xB00327C8,
  0xBF597FC7,
  0xC6E00BF3,
  0xD5A79147,
  0x06CA6351,
  0x14292967,
  0x27B70A85,
  0x2E1B2138,
  0x4D2C6DFC,
  0x53380D13,
  0x650A7354,
  0x766A0ABB,
  0x81C2C92E,
  0x92722C85,
  0xA2BFE8A1,
  0xA81A664B,
  0xC24B8B70,
  0xC76C51A3,
  0xD192E819,
  0xD6990624,
  0xF40E3585,
  0x106AA070,
  0x19A4C116,
  0x1E376C08,
  0x2748774C,
  0x34B0BCB5,
  0x391C0CB3,
  0x4ED8AA4A,
  0x5B9CCA4F,
  0x682E6FF3,
  0x748F82EE,
  0x78A5636F,
  0x84C87814,
  0x8CC70208,
  0x90BEFFFA,
  0xA4506CEB,
  0xBEF9A3F7,
  0xC67178F2,
]
const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))

/** Node 与浏览器共用同步 SHA-256，只用于计时外冻结工作量和证据。 */
export function workloadHash(source: string): string {
  const input = new TextEncoder().encode(source)
  const data = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64)
  data.set(input)
  data[input.length] = 0x80
  const view = new DataView(data.buffer)
  view.setUint32(data.length - 8, Math.floor(input.length / 0x20000000))
  view.setUint32(data.length - 4, input.length * 8)
  const state = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]
  const words = new Uint32Array(64)
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index++) {
      const first = words[index - 15]!
      const second = words[index - 2]!
      words[index] = words[index - 16]! + (rotate(first, 7) ^ rotate(first, 18) ^ (first >>> 3)) + words[index - 7]! + (rotate(second, 17) ^ rotate(second, 19) ^ (second >>> 10))
    }
    let [a, b, c, d, e, f, g, h] = state as [number, number, number, number, number, number, number, number]
    for (let index = 0; index < 64; index++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[index]! + words[index]!) | 0
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g
      g = f
      f = e
      e = (d + first) | 0
      d = c
      c = b
      b = a
      a = (first + second) | 0
    }
    for (const [index, value] of [a, b, c, d, e, f, g, h].entries()) {
      state[index] = (state[index]! + value) >>> 0
    }
  }
  return state.map(value => value.toString(16).padStart(8, '0')).join('')
}

function workloadValue(value: unknown): unknown {
  if (value === undefined) {
    return ['undefined']
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
    return [typeof value, value]
  }
  if (Array.isArray(value)) {
    return ['array', value.map(workloadValue)]
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return ['object', Object.keys(value).sort().map(key => [key, workloadValue(Reflect.get(value, key))])]
  }
  throw new TypeError('Exact workload sharing requires JSON-safe frozen options; functions/resolvers need an explicit implementation identity.')
}

/** 递归保留类型，顶层仅编码一次；避免嵌套字符串转义造成指数膨胀，并拒绝无身份的 resolver。 */
export function workloadJson(value: unknown): string {
  return JSON.stringify(workloadValue(value))
}
