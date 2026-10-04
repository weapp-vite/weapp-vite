import type { SequenceInput } from './driver'
import fs from 'node:fs/promises'
import path from 'pathe'
import { renameAtomicFile } from '../utils/atomicRename'
import { applyAction } from './driver'

export interface SequenceSaveOptions {
  afterSave?: (files: Readonly<Record<string, string>>) => Promise<void>
  fileTimestamp?: Date
}

/** 源编辑只发布完整文件；原子重试不生成额外 revision，也不重置序列期限。 */
export class SequenceSourceWriter {
  private sourceFiles: Record<string, string> = {}

  constructor(private readonly root: string, private readonly noteSourceWrite: (file: string) => void) {}

  get files(): Readonly<Record<string, string>> {
    return this.sourceFiles
  }

  async write(input: SequenceInput, options: SequenceSaveOptions & { started: boolean }) {
    const { signal } = input
    signal.throwIfAborted()
    const save = async (files: Readonly<Record<string, string>>) => {
      for (const file of Object.keys(this.sourceFiles)) {
        signal.throwIfAborted()
        if (!Object.hasOwn(files, file)) {
          this.noteSourceWrite(file)
          await fs.rm(path.join(this.root, file), { force: true })
        }
      }
      for (const [file, content] of Object.entries(files)) {
        signal.throwIfAborted()
        if (this.sourceFiles[file] === content) {
          continue
        }
        const target = path.join(this.root, file)
        // fresh baseline 和活动 watcher 共享源码路径；相同字节不能再次触发活动构建。
        let current: string | undefined
        try {
          current = await fs.readFile(target, { encoding: 'utf8', signal })
        }
        catch (error) {
          signal.throwIfAborted()
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error
          }
        }
        signal.throwIfAborted()
        if (current !== content) {
          this.noteSourceWrite(file)
          await fs.mkdir(path.dirname(target), { recursive: true })
          signal.throwIfAborted()
          const pending = `${target}.pending`
          try {
            await fs.writeFile(pending, content, { signal })
            signal.throwIfAborted()
            if (options.fileTimestamp) {
              await fs.utimes(pending, options.fileTimestamp, options.fileTimestamp)
            }
            await renameAtomicFile(pending, target, { signal })
          }
          catch (error) {
            try {
              await fs.rm(pending, { force: true })
            }
            catch (cleanupError) {
              throw new AggregateError([error, cleanupError], 'Source publication and pending-file cleanup both failed')
            }
            signal.throwIfAborted()
            throw error
          }
        }
      }
      this.sourceFiles = { ...files }
    }
    const renameSource = async (file: string, to: string) => {
      signal.throwIfAborted()
      this.noteSourceWrite(file)
      this.noteSourceWrite(to)
      await fs.mkdir(path.dirname(path.join(this.root, to)), { recursive: true })
      await renameAtomicFile(path.join(this.root, file), path.join(this.root, to), { signal })
      applyAction(this.sourceFiles, { kind: 'rename', file, to })
    }
    if (input.action?.kind === 'rename' && options.started) {
      await renameSource(input.action.file, input.action.to)
    }
    if (input.action?.kind === 'rapid' && options.started) {
      const intermediate = { ...this.sourceFiles }
      for (const action of input.action.saves) {
        signal.throwIfAborted()
        if (action.kind === 'rename') {
          await renameSource(action.file, action.to)
        }
        applyAction(intermediate, action)
        await save(intermediate)
        signal.throwIfAborted()
        await options.afterSave?.({ ...intermediate })
      }
    }
    await save(input.files)
    signal.throwIfAborted()
  }
}
