import { describe, expect, it } from 'vitest'
import { assertInventoryScanResult, inventoryScanResult } from './protocol'

describe('isolated inventory result protocol', () => {
  const root = 'resolved-test-root'
  const nonce = 'owned-request'
  const result = inventoryScanResult(root, nonce)

  it('accepts exactly one result bound to the request root and nonce', () => {
    expect(() => assertInventoryScanResult(`${JSON.stringify(result)}\n`, root, nonce)).not.toThrow()
  })

  it.each([
    ['missing output', ''],
    ['malformed output', '{'],
    ['duplicate output', `${JSON.stringify(result)}\n${JSON.stringify(result)}`],
    ['unexpected output', `scanner ready\n${JSON.stringify(result)}`],
    ['array', JSON.stringify([result])],
    ['null', 'null'],
    ['wrong version', JSON.stringify({ ...result, protocol: 'another-version' })],
    ['wrong nonce', JSON.stringify({ ...result, nonce: 'another-request' })],
    ['wrong root', JSON.stringify({ ...result, rootDirectory: 'another-root' })],
    ['missing status', JSON.stringify({ protocol: result.protocol, rootDirectory: root, nonce })],
    ['failed status', JSON.stringify({ ...result, status: 'error' })],
    ['unexpected fields', JSON.stringify({ ...result, extra: true })],
  ])('rejects %s', (_label, output) => {
    expect(() => assertInventoryScanResult(output, root, nonce)).toThrow(/inventory scanner/)
  })
})
