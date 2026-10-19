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

/** 总计最多三轮，只核验新增身份；初始 RSS、初始未知及任何身份漂移都不能被后轮覆盖。 */
export async function closeResourceInventory(options: {
  initial: ProcessRow[]
  after: ProcessRow[]
  final: ProcessRow[]
  images: Map<number, string[]>
  installationRoot: string
  deadline: number
}) {
  const known = new Map(options.initial.map(row => [row.pid, { row, absent: false }]))
  const newProcesses = new Map<number, NewProcess>()
  const changed = new Set<number>()
  const images = new Map(options.images)
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

  observe(options.after, 1)
  observe(options.final, 1)
  for (let round = 2; round <= 3; round++) {
    const pending = [...newProcesses.values()].filter(entry => !entry.inspected && !changed.has(entry.row.pid) && stableProcess(entry.row, final.get(entry.row.pid)))
    if (!pending.length) {
      break
    }
    if (Date.now() >= options.deadline) {
      inventoryBudgetExhausted = true
      break
    }
    inventoryRoundCount = round
    for (const entry of pending) {
      entry.inspected = true
    }
    try {
      const inspection = await inspectResourceRows(pending.map(entry => entry.row), options.deadline)
      observe(inspection.afterRows, round)
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
      for (const entry of newProcesses.values()) {
        if (!entry.inspected || !stableProcess(entry.row, final.get(entry.row.pid)) || changed.has(entry.row.pid)) {
          continue
        }
        const relation = relationToInstallation(entry.row, options.installationRoot, known, images, final, changed)
        entry.classification = relation === 'foreign' ? 'verified-foreign' : relation === 'unknown' ? 'unclassified' : relation
      }
    }
    catch (error) {
      inventoryBudgetExhausted = Date.now() >= options.deadline
      inventoryInspectionError = error instanceof Error ? error.message : String(error)
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
}
