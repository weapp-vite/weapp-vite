import type { NewProcessObservation, ProcessIdentityChangeObservation, ProcessIdentityGapCause, ProcessInventoryLocation } from '../types'
import type { ResourceKernelPathReader } from './darwinSnapshot'
import type { ProcessRow } from './index'
import { processGapObservation, processIdentityMetadata } from './evidence'
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

/** 总计最多三轮；准备身份后只冻结一次 RSS 锚点，已知缺口及 PID 复用均不被覆盖。 */
export function createResourceInventory(options: {
  initial: ProcessRow[]
  installationRoot: string
  deadline: number
  readPaths: ResourceKernelPathReader
}) {
  const known = new Map(options.initial.map(row => [row.pid, { row, absent: false }]))
  const newProcesses = new Map<number, NewProcess>()
  const changed = new Set<number>()
  const identityChanges = new Map<number, ProcessIdentityChangeObservation>()
  const identityGaps = new Map<number, ProcessIdentityGapCause[]>()
  const images = new Map<number, string[]>()
  const preAnchorExited = new Set<number>()
  let final = new Map(options.initial.map(row => [row.pid, row]))
  let inventoryRoundCount = 1
  let inventoryBudgetExhausted = false
  let fallbackBudgetExhausted = false
  let inventoryInspectionError: string | undefined
  let rssAnchorFrozen = false
  let preparedSelectedRows: ProcessRow[] = []

  function recordIdentityGap(pid: number, reason: ProcessIdentityGapCause['reason'], firstObserved: ProcessInventoryLocation) {
    const causes = identityGaps.get(pid) ?? []
    if (!causes.some(cause => cause.reason === reason)) {
      causes.push({ reason, firstObserved })
      identityGaps.set(pid, causes)
    }
  }

  function observe(rows: ProcessRow[], round: number, location: ProcessInventoryLocation) {
    const next = new Map(rows.map(row => [row.pid, row]))
    for (const [pid, previous] of known) {
      const current = next.get(pid)
      if (!current) {
        previous.absent = true
        recordIdentityGap(pid, 'process-absent', location)
      }
      else if (previous.absent || !sameProcessIdentity(previous.row, current)) {
        changed.add(pid)
        recordIdentityGap(pid, 'identity-changed', location)
        if (!identityChanges.has(pid)) {
          const reasons: ProcessIdentityChangeObservation['reasons'] = []
          if (previous.absent) {
            reasons.push('returned-after-absence')
          }
          if (previous.row.started !== current.started) {
            reasons.push('started-changed')
          }
          if (previous.row.parentPid !== current.parentPid) {
            reasons.push('parent-changed')
          }
          if (previous.row.zombie !== current.zombie) {
            reasons.push('zombie-changed')
          }
          identityChanges.set(pid, { ...processIdentityMetadata(previous.row), changedTo: processIdentityMetadata(current), reasons, firstObserved: location })
        }
      }
    }
    for (const row of rows) {
      if (known.has(row.pid)) {
        continue
      }
      const entry: NewProcess = { row, absent: false, firstSeenRound: round, inspected: false, classification: 'unclassified', imageSource: 'not-verified' }
      known.set(row.pid, entry)
      newProcesses.set(row.pid, entry)
      if (row.zombie) {
        recordIdentityGap(row.pid, 'zombie', location)
      }
    }
    final = next
  }

  function classifyInspected() {
    for (const entry of newProcesses.values()) {
      if (preAnchorExited.has(entry.row.pid) || !entry.inspected || !stableProcess(entry.row, final.get(entry.row.pid)) || changed.has(entry.row.pid)) {
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
        observe(rows, round, { round, phase: 'after-kernel' })
        for (const [pid, executableImages] of kernelImages) {
          images.set(pid, executableImages)
        }
        for (const entry of pending) {
          if (kernelImages.has(entry.row.pid)) {
            entry.imageSource = 'kernel-path'
          }
        }
        classifyInspected()
      }, round, options.readPaths)
      for (const [pid, cause] of inspection.imageGaps) {
        recordIdentityGap(pid, cause.reason, cause.firstObserved)
      }
      observe(inspection.finalRows, round, { round, phase: 'after-fallback' })
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
      observe(rows, 1, { round: 1, phase: 'after-kernel' })
      // 准备阶段只固定身份；第 2、3 轮留给唯一 RSS 锚点后的新增身份。
    },
    completePreparation(rows: ProcessRow[], preparationImages: Map<number, string[]>, imageGaps: Map<number, ProcessIdentityGapCause>) {
      for (const [pid, executableImages] of preparationImages) {
        images.set(pid, executableImages)
      }
      for (const [pid, cause] of imageGaps) {
        recordIdentityGap(pid, cause.reason, cause.firstObserved)
      }
      observe(rows, 1, { round: 1, phase: 'after-fallback' })
    },
    freezeRssAnchor(rows: ProcessRow[], preparationMembers: Set<number>) {
      if (rssAnchorFrozen) {
        throw new Error('Resource sampling cannot replace its fixed RSS anchor.')
      }
      rssAnchorFrozen = true
      observe(rows, 1, { round: 1, phase: 'rss-anchor' })
      let added = true
      while (added) {
        added = false
        for (const [pid, entry] of known) {
          if (!preparationMembers.has(pid) && preparationMembers.has(entry.row.parentPid)) {
            preparationMembers.add(pid)
            added = true
          }
        }
      }
      preparedSelectedRows = [...known.values()].filter(entry => preparationMembers.has(entry.row.pid)).map(entry => entry.row)
      for (const [pid, entry] of known) {
        if (final.has(pid) || changed.has(pid) || preparationMembers.has(pid)) {
          continue
        }
        const relation = relationToInstallation(entry.row, options.installationRoot, known, images, final, changed)
        if (relation === 'installation-image' || relation === 'descendant') {
          continue
        }
        // 准备阶段未知身份已在 RSS 锚点前退出，记录事实而不推断外国归属。
        preAnchorExited.add(pid)
        recordIdentityGap(pid, 'pre-anchor-exited', { round: 1, phase: 'rss-anchor' })
        const pending = newProcesses.get(pid)
        if (pending) {
          pending.classification = 'pre-anchor-exited'
        }
      }
    },
    async close(rows: ProcessRow[], initialImages: Map<number, string[]>) {
      for (const [pid, executableImages] of initialImages) {
        images.set(pid, executableImages)
      }
      observe(rows, inventoryRoundCount, { round: 1, phase: rssAnchorFrozen ? 'after-anchor' : 'after-fallback' })
      // 已经前后核验的外国身份后来退出不抹除证据；从未核验的退出条目仍未知。
      classifyInspected()
      for (let round = inventoryRoundCount + 1; round <= 3 && !inventoryInspectionError && !inventoryBudgetExhausted; round++) {
        if (!await inspectPending(round)) {
          break
        }
      }
      const observations: NewProcessObservation[] = [...newProcesses.values()].map(entry => ({
        ...processGapObservation(entry.row, final.get(entry.row.pid), undefined, identityGaps.get(entry.row.pid)),
        firstSeenRound: entry.firstSeenRound,
        classification: changed.has(entry.row.pid) ? 'identity-changed' : entry.classification,
        imageSource: entry.imageSource,
      }))
      return {
        final,
        images,
        preparedSelectedRows,
        preAnchorExitedProcesses: [...preAnchorExited].map(pid => processGapObservation(known.get(pid)!.row, final.get(pid), undefined, identityGaps.get(pid))),
        changedProcessPids: changed,
        identityGaps,
        identityChangedProcesses: [...identityChanges.values()],
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
