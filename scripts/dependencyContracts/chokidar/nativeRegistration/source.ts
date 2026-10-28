import type { WatchEventType, WatchListener } from 'node:fs'
import { EventEmitter } from 'node:events'
import { statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

interface NativeOptions {
  persistent?: boolean
  recursive?: boolean
}

type GapAction = () => void

/** 只提供 fs.watch 的公开句柄面；生产代码不能依赖 fixture 的私有原生形状。 */
export class NativeRegistrationHandle extends EventEmitter {
  live = true
  armed: boolean
  closeCalls = 0
  readonly recursive: boolean
  private persistent: boolean

  constructor(
    private readonly source: NativeRegistrationSource,
    readonly file: string,
    readonly directory: boolean,
    options: NativeOptions,
    listener?: WatchListener<string>,
  ) {
    super()
    this.armed = !directory
    this.recursive = options.recursive === true
    this.persistent = options.persistent ?? true
    if (listener) {
      this.on('change', listener)
    }
  }

  close() {
    this.closeCalls += 1
    if (this.live) {
      this.live = false
      this.source.closed(this)
      process.nextTick(() => this.emit('close'))
    }
    return this
  }

  /** Node 启动错误先关闭底层句柄再广播错误，不产生公开 close 事件。 */
  failStart(error: Error) {
    if (!this.live) {
      return
    }
    this.live = false
    this.source.closed(this)
    this.emit('error', error)
  }

  ref() {
    this.persistent = true
    return this
  }

  unref() {
    this.persistent = false
    return this
  }

  hasRef() {
    return this.persistent
  }
}

/** 对应 libuv 的目录异步登记、关闭同步重建及 SinceNow 丢失窗口，不模拟 Chokidar 的协调算法。 */
export class NativeRegistrationSource {
  readonly handles: NativeRegistrationHandle[] = []
  readonly rebuilds: Array<{ reason: 'registration' | 'close', paths: string[], failed: boolean }> = []
  readonly gapWrites: string[] = []
  readonly registrationFailures: Array<{ file: string, error: Error }> = []
  peakLive = 0
  peakExtraDirectories = 0
  private gapAction?: GapAction
  private startError?: Error
  private nextDirectoryRegistrationError?: Error
  private rebuilding = false
  private registrationScheduled = false
  private readonly registrationWaiters = new Set<() => void>()

  constructor(readonly root: string) {}

  readonly watch = (file: unknown, options?: NativeOptions | string | WatchListener<string>, listener?: WatchListener<string>) => {
    if (typeof file !== 'string') {
      throw new TypeError('Native source fixture requires a string path')
    }
    const resolved = path.resolve(file)
    const relative = path.relative(this.root, resolved)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Native source fixture cannot acquire a path outside its owned root')
    }
    const resolvedOptions = typeof options === 'object' && options !== null ? options : {}
    const resolvedListener = typeof options === 'function' ? options : listener
    const directory = statSync(resolved).isDirectory()
    if (directory && this.nextDirectoryRegistrationError) {
      const error = this.nextDirectoryRegistrationError
      this.nextDirectoryRegistrationError = undefined
      this.registrationFailures.push({ file: resolved, error })
      throw error
    }
    const handle = new NativeRegistrationHandle(this, resolved, directory, resolvedOptions, resolvedListener)
    this.handles.push(handle)
    this.sample()
    for (const notify of this.registrationWaiters) {
      notify()
    }
    // CF 线程可以迟于公开 ready 才处理登记；仅显式安排的交错会主动推进它。
    if (handle.directory && (this.gapAction || this.startError) && !this.registrationScheduled) {
      this.registrationScheduled = true
      queueMicrotask(() => {
        this.registrationScheduled = false
        if (this.gapAction || this.startError) {
          this.rebuild('registration')
        }
      })
    }
    return handle
  }

  get live() {
    return this.handles.filter(handle => handle.live)
  }

  get fileHandles() {
    return this.handles.filter(handle => !handle.directory)
  }

  duringNextRebuild(action: GapAction) {
    if (this.gapAction) {
      throw new Error('A native source gap action is already pending')
    }
    this.gapAction = action
  }

  rejectStreamStarts(error: Error) {
    this.startError = error
  }

  /** 对应 fs.watch 同步注册失败；只拒绝下一次目录登记，不改变既有句柄。 */
  rejectNextDirectoryRegistration(error: Error) {
    if (this.nextDirectoryRegistrationError) {
      throw new Error('A directory registration rejection is already pending')
    }
    this.nextDirectoryRegistrationError = error
  }

  /** 写入真实文件；目录流停止期间的通知丢失，独立文件 kqueue 通知仍可到达。 */
  write(file: string, value: string) {
    writeFileSync(file, value, { flag: 'r+' })
    if (this.rebuilding) {
      this.gapWrites.push(file)
    }
    this.publish(file, 'change')
  }

  publish(file: string, event: WatchEventType) {
    for (const handle of this.live) {
      if (handle.directory && (!handle.armed || this.rebuilding)) {
        continue
      }
      const relative = path.relative(handle.file, file)
      if (handle.directory) {
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
          || (!handle.recursive && relative.includes(path.sep))) {
          continue
        }
        handle.emit('change', event, relative || null)
      }
      else if (handle.file === file) {
        handle.emit('change', event, path.basename(file))
      }
    }
  }

  /** 已在原生层排队的回调仍可晚于 owner close/unwatch 交还。 */
  deliverLate(handle: NativeRegistrationHandle, file: string) {
    handle.emit('change', 'change', handle.directory ? path.relative(handle.file, file) : path.basename(file))
  }

  async registered(file: string, previous?: NativeRegistrationHandle) {
    const find = () => this.handles.find(handle => handle.directory && handle.file === file && handle !== previous && handle.live)
    const existing = find()
    if (existing) {
      return existing
    }
    return new Promise<NativeRegistrationHandle>((resolve) => {
      const notify = () => {
        const handle = find()
        if (handle) {
          this.registrationWaiters.delete(notify)
          resolve(handle)
        }
      }
      this.registrationWaiters.add(notify)
    })
  }

  closed(handle: NativeRegistrationHandle) {
    if (handle.directory) {
      // uv__fsevents_close 等待 CF semaphore；重建影响同 loop 的全部存活目录流。
      this.rebuild('close')
    }
    this.sample()
  }

  private rebuild(reason: 'registration' | 'close') {
    const directories = this.live.filter(handle => handle.directory)
    this.rebuilding = true
    for (const handle of directories) {
      handle.armed = false
    }
    const action = this.gapAction
    this.gapAction = undefined
    try {
      action?.()
    }
    finally {
      this.rebuilding = false
    }
    const error = this.startError
    this.rebuilds.push({ reason, paths: directories.map(handle => handle.file), failed: Boolean(error) })
    if (error) {
      // FSEventStreamStart 失败经其余句柄广播；close 返回不等于流启动成功。
      for (const handle of directories) {
        queueMicrotask(() => {
          if (handle.live) {
            handle.failStart(error)
          }
        })
      }
    }
    else {
      for (const handle of directories) {
        handle.armed = true
      }
    }
  }

  private sample() {
    this.peakLive = Math.max(this.peakLive, this.live.length)
    const directories = this.live.filter(handle => handle.directory)
    const distinct = new Set(directories.map(handle => handle.file))
    this.peakExtraDirectories = Math.max(this.peakExtraDirectories, directories.length - distinct.size)
  }
}
