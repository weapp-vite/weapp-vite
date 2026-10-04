import type { EditAction, SequenceInput } from './driver'
import fs from 'node:fs/promises'
import path from 'node:path'
import { renameAtomicFile } from '../utils/atomicRename'
import { applyAction } from './driver'

/** 保留 framework fixture 的直接保存方式；重命名沿用共享锁重试及原序列期限。 */
export async function writeFrameworkSequenceSources(root: string, previousFiles: Readonly<Record<string, string>>, input: SequenceInput) {
  const { signal } = input
  signal.throwIfAborted()
  const write = async (file: string, content: string) => {
    signal.throwIfAborted()
    const target = path.join(root, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, { signal })
  }
  const mutate = async (action: Exclude<EditAction, { kind: 'rapid' }>, files: Record<string, string>) => {
    signal.throwIfAborted()
    applyAction(files, action)
    if (action.kind === 'delete') {
      await fs.rm(path.join(root, action.file), { force: true })
    }
    else if (action.kind === 'rename') {
      await fs.mkdir(path.dirname(path.join(root, action.to)), { recursive: true })
      await renameAtomicFile(path.join(root, action.file), path.join(root, action.to), { signal })
    }
    else {
      await write(action.file, files[action.file]!)
    }
  }
  if (input.action) {
    const files = { ...previousFiles }
    for (const action of input.action.kind === 'rapid' ? input.action.saves : [input.action]) {
      await mutate(action, files)
    }
  }
  else {
    for (const [file, content] of Object.entries(input.files)) {
      await write(file, content)
    }
  }
  signal.throwIfAborted()
}
