import process from 'node:process'
import { runRssSamplingCommand } from './rssCommand'

export function sumProcessTreeRss(
  rootPid: number,
  entries: Array<{ pid: number, ppid: number, rssBytes: number }>,
) {
  const childrenByParent = new Map<number, Array<{ pid: number, rssBytes: number }>>()
  const rssByPid = new Map<number, number>()
  for (const entry of entries) {
    rssByPid.set(entry.pid, entry.rssBytes)
    const children = childrenByParent.get(entry.ppid) ?? []
    children.push({ pid: entry.pid, rssBytes: entry.rssBytes })
    childrenByParent.set(entry.ppid, children)
  }

  const visited = new Set<number>()
  const stack = [rootPid]
  let total = 0
  while (stack.length) {
    const pid = stack.pop()!
    if (visited.has(pid)) {
      continue
    }
    visited.add(pid)
    total += rssByPid.get(pid) ?? 0
    for (const child of childrenByParent.get(pid) ?? []) {
      stack.push(child.pid)
    }
  }
  return total || null
}

async function sampleUnixProcessTreeRssBytes(rootPid: number) {
  const stdout = await runRssSamplingCommand('ps', ['-Ao', 'pid=,ppid=,rss='])
  if (stdout === null) {
    return null
  }
  const entries = stdout
    .split('\n')
    .map((line) => {
      const [pid, ppid, rssKb] = line.trim().split(/\s+/).map(value => Number.parseInt(value, 10))
      return Number.isFinite(pid) && Number.isFinite(ppid) && Number.isFinite(rssKb)
        ? { pid, ppid, rssBytes: rssKb * 1024 }
        : undefined
    })
    .filter((entry): entry is { pid: number, ppid: number, rssBytes: number } => entry !== undefined)
  return sumProcessTreeRss(rootPid, entries)
}

async function sampleWindowsProcessTreeRssBytes(rootPid: number) {
  const stdout = await runRssSamplingCommand('powershell', [
    '-NoProfile',
    '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress',
  ])
  if (!stdout?.trim()) {
    return null
  }
  const parsed = JSON.parse(stdout) as unknown
  const items = Array.isArray(parsed) ? parsed : [parsed]
  const entries = items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return undefined
      }
      const record = item as Record<string, unknown>
      const pid = Number(record.ProcessId)
      const ppid = Number(record.ParentProcessId)
      const rssBytes = Number(record.WorkingSetSize)
      return Number.isFinite(pid) && Number.isFinite(ppid) && Number.isFinite(rssBytes)
        ? { pid, ppid, rssBytes }
        : undefined
    })
    .filter((entry): entry is { pid: number, ppid: number, rssBytes: number } => entry !== undefined)
  return sumProcessTreeRss(rootPid, entries)
}

export async function sampleProcessTreeRssBytes(rootPid: number) {
  if (process.platform === 'win32') {
    return await sampleWindowsProcessTreeRssBytes(rootPid)
  }
  return await sampleUnixProcessTreeRssBytes(rootPid)
}
