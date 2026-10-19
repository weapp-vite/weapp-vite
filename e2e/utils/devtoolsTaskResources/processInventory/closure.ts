import type { NewProcessObservation } from '../types'
import type { ProcessRow } from './index'
import { insideInstallation, inspectResourceRows, sameProcessIdentity, stableProcess } from './index'

interface TrackedProcess {
  row: ProcessRow
  absent: boolean
}

interface NewProcess extends TrackedProcess {
  firstSeenRound: number
  inspected: boolean
  classification: NewProcessObservation['classification']
  imageSource: NewProcessObservation['imageSource']
}

type Relation = 'installation-image' | 'descendant' | 'foreign' | 'unknown'

/** 仅明确映像及稳定祖先链可证明负归属；未知父进程、环及消失的祖先均不作外国进程。 */
function relationToInstallation(
  row: ProcessRow,
  installationRoot: string,
  known: Map<number, TrackedProcess>,
  images: Map<number, string[]>,
  current: Map<number, ProcessRow>,
  changed: Set<number>,
  visiting = new Set<number>(),
): Relation {
  if (visiting.has(row.pid) || changed.has(row.pid)) {
    return 'unknown'
  }
  const executableImages = images.get(row.pid)
  if (executableImages?.some(image => insideInstallation(installationRoot, image))) {
    return 'installation-image'
  }
  visiting.add(row.pid)
  const parent = known.get(row.parentPid)
  const parentRelation = parent
    ? relationToInstallation(parent.row, installationRoot, known, images, current, changed, visiting)
    : 'unknown'
  if (parentRelation === 'installation-image' || parentRelation === 'descendant') {
    return 'descendant'
  }
  if (!executableImages || !stableProcess(row, current.get(row.pid))) {
    return 'unknown'
  }
  return row.parentPid <= 1 || parentRelation === 'foreign' ? 'foreign' : 'unknown'
}

/** 总计最多三轮；首个后验清单发现的新身份提前核验，初始 RSS 与未知不被覆盖。 */
export function createResourceInventory(options: {
  initial: ProcessRow[]
  installationRoot: string
  deadline: number
}) {
  const known = new Map(options.initial.map(row => [row.pid, { row, absent: false }]))
  const newProcesses = new Map<number, NewProcess>()
  const changed = new Set<number>()
  const images = new Map<number, string[]>()
  let final = new Map(options.initial.map(row => [row.pid, row]))
  let inventoryRoundCount = 1
  let inventoryBudgetExhausted = false
  let fallbackBudgetExhausted = false
  let inventoryInspectionError: string | undefined

  function observe(rows: ProcessRow[], round: number) {
    const next = new Map(rows.map(row => [row.pid, row]))
    for (const [pid, previous] of known) {
      const current = next.get(pid)
      if (!current) {
        previous.absent = true
      }
      else if (previous.absent || !sameProcessIdentity(previous.row, current)) {
        changed.add(pid)
      }
    }
    for (const row of rows) {
      if (known.has(row.pid)) {
        continue
      }
      const entry: NewProcess = { row, absent: false, firstSeenRound: round, inspected: false, classification: 'unclassified', imageSource: 'not-verified' }
      known.set(row.pid, entry)
      newProcesses.set(row.pid, entry)
    }
    final = next
  }

  function classifyInspected() {
    for (const entry of newProcesses.values()) {
      if (!entry.inspected || !stableProcess(entry.row, final.get(entry.row.pid)) || changed.has(entry.row.pid)) {
        continue
      }
      const relation = relationToInstallation(entry.row, options.installationRoot, known, images, final, changed)
      entry.classification = relation === 'foreign' ? 'verified-foreign' : relation === 'unknown' ? 'unclassified' : relation
    }
  }

  async function inspectPending(round: number) {
    const pending = [...newProcesses.values()].filter(entry => !entry.inspected && !changed.has(entry.row.pid) && stableProcess(entry.row, final.get(entry.row.pid)))
    if (!pending.length) {
      return false
    }
    if (Date.now() >= options.deadline) {
      inventoryBudgetExhausted = true
      return false
    }
    inventoryRoundCount = round
    for (const entry of pending) {
      entry.inspected = true
    }
    try {
      const inspection = await inspectResourceRows(pending.map(entry => entry.row), options.deadline, async (rows, kernelImages) => {
        observe(rows, round)
        for (const [pid, executableImages] of kernelImages) {
          images.set(pid, executableImages)
        }
        for (const entry of pending) {
          if (kernelImages.has(entry.row.pid)) {
            entry.imageSource = 'kernel-path'
          }
        }
        classifyInspected()
      })
      observe(inspection.finalRows, round)
      fallbackBudgetExhausted ||= inspection.fallbackBudgetExhausted
      for (const [pid, executableImages] of inspection.images) {
        images.set(pid, executableImages)
      }
      for (const entry of pending) {
        const { pid } = entry.row
        if (inspection.images.has(pid)) {
          entry.imageSource = inspection.paths.get(pid) === null ? 'text-images' : 'kernel-path'
        }
      }
      classifyInspected()
    }
    catch (error) {
      inventoryBudgetExhausted = Date.now() >= options.deadline
      inventoryInspectionError = error instanceof Error ? error.message : String(error)
      return false
    }
    return true
  }

  return {
    async afterInitialKernel(rows: ProcessRow[], kernelImages: Map<number, string[]>) {
      for (const [pid, executableImages] of kernelImages) {
        images.set(pid, executableImages)
      }
      observe(rows, 1)
      // 复用原第 2 轮预算；先绑定新身份，再等待初始 null-path 的 lsof fallback。
      await inspectPending(2)
    },
    async close(rows: ProcessRow[], initialImages: Map<number, string[]>) {
      for (const [pid, executableImages] of initialImages) {
        images.set(pid, executableImages)
      }
      observe(rows, inventoryRoundCount)
      // 已经前后核验的外国身份后来退出不抹除证据；从未核验的退出条目仍未知。
      classifyInspected()
      for (let round = inventoryRoundCount + 1; round <= 3 && !inventoryInspectionError && !inventoryBudgetExhausted; round++) {
        if (!await inspectPending(round)) {
          break
        }
      }
      const observations: NewProcessObservation[] = [...newProcesses.values()].map(entry => ({
        pid: entry.row.pid,
        parentPid: entry.row.parentPid,
        started: entry.row.started,
        firstSeenRound: entry.firstSeenRound,
        classification: changed.has(entry.row.pid) ? 'identity-changed' : entry.classification,
        imageSource: entry.imageSource,
      }))
      return {
        final,
        changedProcessPids: changed,
        newProcesses: observations,
        verifiedNewForeignProcessCount: observations.filter(entry => entry.classification === 'verified-foreign').length,
        newSelectedProcessCount: observations.filter(entry => entry.classification === 'installation-image' || entry.classification === 'descendant').length,
        uninspectedNewProcessCount: observations.filter(entry => entry.classification === 'unclassified').length,
        identityChangedProcessCount: changed.size,
        inventoryRoundCount,
        inventoryBudgetExhausted,
        fallbackBudgetExhausted,
        inventoryInspectionError,
      }
    },
  }
}
