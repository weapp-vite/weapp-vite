import fs from 'node:fs'
import path from 'node:path'

/** 仅回收本 fixture 向 mock bridge 派发、且 baseline 中不存在的快照。 */
export function createMockBridgeSnapshotCleanup(wrapperRoot: string, bridgePath: string) {
  const root = path.resolve(wrapperRoot)
  fs.mkdirSync(root, { recursive: true })
  const initialRoot = fs.lstatSync(root)
  if (!initialRoot.isDirectory() || initialRoot.isSymbolicLink()) {
    throw new Error('Mock bridge snapshot root must be a non-symlink directory')
  }
  const canonicalRoot = fs.realpathSync(root)
  const baseline = new Set(fs.readdirSync(root))

  return (calls: readonly (readonly unknown[])[]) => {
    const candidates = new Set<string>()
    for (const [command, args] of calls) {
      if (command !== 'node' || !Array.isArray(args)
        || args[0] !== '--import' || args[1] !== 'tsx' || args[2] !== bridgePath
        || typeof args[3] !== 'string') {
        continue
      }
      let payload: unknown
      try {
        payload = JSON.parse(args[3])
      }
      catch {
        continue
      }
      if (!payload || typeof payload !== 'object' || !('projectPath' in payload)
        || typeof payload.projectPath !== 'string') {
        continue
      }
      const projectPath = payload.projectPath
      if (path.isAbsolute(projectPath) && path.dirname(projectPath) === root
        && /^[a-f0-9]{16}$/i.test(path.basename(projectPath))
        && !baseline.has(path.basename(projectPath))) {
        candidates.add(projectPath)
      }
    }

    const removed: string[] = []
    for (const projectPath of candidates) {
      const currentRoot = fs.lstatSync(root, { throwIfNoEntry: false })
      if (!currentRoot?.isDirectory() || currentRoot.isSymbolicLink()
        || currentRoot.dev !== initialRoot.dev || currentRoot.ino !== initialRoot.ino
        || fs.realpathSync(root) !== canonicalRoot) {
        throw new Error('Mock bridge snapshot root identity changed; snapshots were preserved')
      }
      const candidate = fs.lstatSync(projectPath, { throwIfNoEntry: false })
      if (!candidate?.isDirectory() || candidate.isSymbolicLink()
        || path.dirname(fs.realpathSync(projectPath)) !== canonicalRoot) {
        continue
      }
      fs.rmSync(projectPath, { recursive: true, force: true })
      removed.push(projectPath)
    }
    return removed
  }
}
