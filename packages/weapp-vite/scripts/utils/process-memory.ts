/* eslint-disable ts/no-use-before-define */
import process from 'node:process'

/* eslint-disable-next-line e18e/ban-dependencies -- benchmark memory sampling needs cross-platform child process inspection. */
import { execa } from 'execa'

export interface MemorySummary {
  max: number | null
  mean: number | null
  min: number | null
  samples: number[]
}

export function createPeakRssSampler(rootPid: number | undefined) {
  let rssPeakBytes: number | null = null

  const sample = async () => {
    if (typeof rootPid !== 'number') {
      return
    }
    const current = await sampleProcessTreeRssBytes(rootPid).catch(() => null)
    if (current != null) {
      rssPeakBytes = Math.max(rssPeakBytes ?? 0, current)
    }
  }

  const timer = setInterval(() => {
    void sample()
  }, 100)
  void sample()

  return {
    async stop() {
      clearInterval(timer)
      await sample()
      return { rssPeakBytes }
    },
  }
}

export function summarizeOptionalMemory(values: Array<number | null | undefined>): MemorySummary {
  const samples = values.filter((value): value is number => Number.isFinite(value))
  const sorted = [...samples].sort((a, b) => a - b)
  const total = samples.reduce((sum, value) => sum + value, 0)
  return {
    max: sorted.at(-1) ?? null,
    mean: samples.length ? total / samples.length : null,
    min: sorted[0] ?? null,
    samples,
  }
}

export function formatMemoryMiB(value: number | null | undefined) {
  return typeof value === 'number'
    ? `${(value / 1024 / 1024).toFixed(1)} MiB`
    : '-'
}

async function sampleProcessTreeRssBytes(rootPid: number) {
  if (process.platform === 'win32') {
    return await sampleWindowsProcessTreeRssBytes(rootPid)
  }
  return await sampleUnixProcessTreeRssBytes(rootPid)
}

async function sampleUnixProcessTreeRssBytes(rootPid: number) {
  const { stdout } = await execa('ps', ['-Ao', 'pid=,ppid=,rss='], {
    reject: false,
    stdin: 'ignore',
  })
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
  const { stdout } = await execa('powershell', [
    '-NoProfile',
    '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress',
  ], {
    reject: false,
    stdin: 'ignore',
  })
  if (!stdout.trim()) {
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

function sumProcessTreeRss(
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
