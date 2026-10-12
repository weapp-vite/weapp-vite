import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDarwinKernelPaths } from './darwinKernelPaths'

const command = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: command }))
beforeEach(() => vi.resetAllMocks())

describe('macOS kernel identity wire validation', () => {
  it('binds strict entries to requested PIDs independently of response ordering', async () => {
    command.mockResolvedValue({
      stdout: JSON.stringify([{ pid: 22, executable: null }, { pid: 21, executable: '/kernel/path with spaces' }]),
      exitCode: 0,
      stderr: '',
    })
    expect(await readDarwinKernelPaths([21, 22])).toEqual(new Map([[22, null], [21, '/kernel/path with spaces']]))
  })

  it.each([
    null,
    true,
    21,
    'paths',
    { pid: 21, executable: null },
    [null],
    [[]],
    [{ pid: '21', executable: null }],
    [{ pid: 0, executable: null }],
    [{ pid: -21, executable: null }],
    [{ pid: 21.5, executable: null }],
    [{ pid: Number.MAX_SAFE_INTEGER + 1, executable: null }],
    [{ executable: null }],
    [{ pid: 21 }],
    [{ pid: 21, executable: 42 }],
    [{ pid: 21, executable: false }],
    [{ pid: 21, executable: {} }],
    [{ pid: 21, executable: null, title: 'npm' }],
  ].map(response => ({ response })))('rejects malformed or expanded kernel identity payloads: $response', async ({ response }) => {
    command.mockResolvedValue({ stdout: JSON.stringify(response), exitCode: 0, stderr: '' })
    await expect(readDarwinKernelPaths([21])).rejects.toThrow('incomplete kernel executable paths')
  })
})
