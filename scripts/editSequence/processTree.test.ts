import { expect, it } from 'vitest'
import { parseProcessMemory, summarizeProcessTree } from './processTree'

it('counts the entire owned process tree without including unrelated workers', () => {
  const rows = parseProcessMemory('10 1 20\n12 11 30\n11 10 40\n90 1 9000\n', 'darwin')
  expect(summarizeProcessTree(rows, 10)).toMatchObject({ rssBytes: 90 * 1024, processCount: 3 })
  expect(() => summarizeProcessTree(rows, 100)).toThrow('exited')
})

it('keeps Windows RSS in bytes and handles one row and CRLF output', () => {
  const rows = parseProcessMemory('{"ProcessId":10,"ParentProcessId":1,"WorkingSetSize":"2048"}\r\n', 'win32')
  expect(summarizeProcessTree(rows, 10).rssBytes).toBe(2048)
  expect(() => summarizeProcessTree([{ pid: 10, parentPid: 1, rssBytes: Number.NaN }], 10)).toThrow('Invalid')
})
