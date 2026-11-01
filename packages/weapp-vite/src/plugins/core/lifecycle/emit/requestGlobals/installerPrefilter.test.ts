import { REQUEST_GLOBAL_INSTALLER_MARKER } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { findRequestGlobalsInstaller } from './installer'

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

const markerLiteral = JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)
const escapedMarker = REQUEST_GLOBAL_INSTALLER_MARKER.split('')
  .map(character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
  .join('')
const markerHead = REQUEST_GLOBAL_INSTALLER_MARKER.slice(0, -1)
const markerTail = JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER.slice(-1))

function marked(key: string) {
  return `function renamed() {} Object.defineProperty(renamed, ${key}, { value: true });`
}

function parseCount(code: string) {
  return vi.mocked(parseJsLike).mock.calls.filter(([source]) => source === code).length
}

describe('installer conservative negative prefilter', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
  })

  it.each([
    ['string key', marked(markerLiteral)],
    ['template key', marked(`\`${REQUEST_GLOBAL_INSTALLER_MARKER}\``)],
    ['string aliases', `const key = ${markerLiteral}; const first = key; const second = first; function renamed() {} renamed[second] = true;`],
    ['template aliases', `const key = \`${REQUEST_GLOBAL_INSTALLER_MARKER}\`; const first = key; const second = first; ${marked('second')}`],
    ['escaped string key', marked(`"${escapedMarker}"`)],
    ['escaped template key', marked(`\`${escapedMarker}\``)],
    ['escaped key aliases', `const key = "${escapedMarker}"; const first = key; const second = first; ${marked('second')}`],
    ['escaped installer identifier', `function \\u0072enamed() {} Object.defineProperty(\\u0072enamed, ${markerLiteral}, { value: true });`],
  ])('keeps the original AST path for %s', (_, code) => {
    expect(findRequestGlobalsInstaller(code)).toBe('renamed')
    expect(parseCount(code)).toBe(1)
  })

  it.each([
    ['ESM alias', 'function renamed() {} export { renamed as installWebRuntimeGlobals };', 'renamed'],
    ['ESM declaration', 'export function installWebRuntimeGlobals() {}', 'installWebRuntimeGlobals'],
    ['CJS assignment', 'function renamed() {} exports.installWebRuntimeGlobals = renamed;', 'renamed'],
    ['CJS getter', 'function renamed() {} Object.defineProperty(exports, "installWebRuntimeGlobals", { get() { return renamed; } });', 'renamed'],
    ['CJS key aliases', 'const key = "installWebRuntimeGlobals"; const first = key; const second = first; function renamed() {} exports[second] = renamed;', 'renamed'],
    ['escaped public declaration', 'export function \\u0069nstallWebRuntimeGlobals() {}', 'installWebRuntimeGlobals'],
    ['escaped public specifier', 'function renamed() {} export { renamed as \\u0069nstallWebRuntimeGlobals };', 'renamed'],
    ['escaped public string', 'function renamed() {} exports["\\u0069nstallWebRuntimeGlobals"] = renamed;', 'renamed'],
    ['escaped public template', 'function renamed() {} exports[`\\u0069nstallWebRuntimeGlobals`] = renamed;', 'renamed'],
    ['escaped local export', 'function \\u0072enamed() {} export { \\u0072enamed as installWebRuntimeGlobals };', 'renamed'],
  ])('keeps marker-free public exports: %s', (_, code, expected) => {
    expect(findRequestGlobalsInstaller(code)).toBe(expected)
    expect(parseCount(code)).toBe(1)
  })

  it.each([
    ['unrelated source', 'function unrelated() { return ["fetch", "URL"]; } exports.value = unrelated;'],
    ['unrelated function name', 'function renamed() {} exports.value = renamed;'],
    ['dynamic call key', 'function renamed() {} renamed[getRuntimeKey()] = true;'],
    ['dynamic defineProperty key', 'function renamed() {} Object.defineProperty(renamed, getRuntimeKey(), { value: true });'],
    ['dynamic concatenation', `function renamed() {} const tail = ${markerTail}; renamed[${JSON.stringify(markerHead)} + tail] = true;`],
    ['interpolated template', `function renamed() {} const tail = ${markerTail}; renamed[\`${markerHead}${'$' + '{tail}'}\`] = true;`],
  ])('does not parse unsupported or unrelated source without any retained clue: %s', (_, code) => {
    expect(findRequestGlobalsInstaller(code)).toBeNull()
    expect(parseCount(code)).toBe(0)
  })

  it.each([
    ['marker in unsupported key', `function renamed() {} renamed[choose(${markerLiteral})] = true;`],
    ['public name in unsupported key', 'function renamed() {} renamed["installWebRuntimeGlobals" + suffix] = true;'],
    ['unrelated escape', 'function renamed() {} const note = "\\n"; renamed[getRuntimeKey()] = true;'],
    ['marker on a non-function', `const value = {}; value[${markerLiteral}] = true;`],
  ])('still parses a retained clue even if the AST cannot identify an installer: %s', (_, code) => {
    expect(findRequestGlobalsInstaller(code)).toBeNull()
    expect(parseCount(code)).toBe(1)
  })

  it('re-evaluates the same source variable from negative to positive to retired without caching', () => {
    let code = 'exports.phase = "empty";'
    expect(findRequestGlobalsInstaller(code)).toBeNull()
    expect(parseCount(code)).toBe(0)

    code = marked(markerLiteral)
    expect(findRequestGlobalsInstaller(code)).toBe('renamed')
    expect(parseCount(code)).toBe(1)
    expect(findRequestGlobalsInstaller(code)).toBe('renamed')
    expect(parseCount(code)).toBe(2)

    code = 'exports.phase = "retired";'
    expect(findRequestGlobalsInstaller(code)).toBeNull()
    expect(parseCount(code)).toBe(0)
  })
})
