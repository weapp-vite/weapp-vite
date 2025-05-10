import type { FSWatcher } from 'chokidar'
import type { EventName } from 'chokidar/handler.js'
import chokidar from 'chokidar'
import fs from 'fs-extra'
import mockFs from 'mock-fs'
import path from 'pathe'

type Listener = (event: EventName, path: string, stats?: fs.Stats | undefined) => void

function sleep(delay: number = 100) {
  return new Promise(resolve => setTimeout(resolve, delay))
}

function watchFile(path: string, listener: Listener) {
  const watcher = chokidar.watch(path, {
    persistent: true,
  })

  watcher.on('all', listener)

  return watcher
}

describe('chokidar', () => {
  const dirPath = path.resolve(__dirname, 'fixtures/chokidar')
  const watchPath = path.resolve(dirPath)
  let watcher: FSWatcher
  const filePath = path.resolve(dirPath, 'j.ts')
  beforeEach(() => {
    // 模拟文件系统
    mockFs({
      [filePath]: 'initial content',
    })
  })

  afterEach(async () => {
    if (watcher) {
      await watcher.close()
    }
    mockFs.restore()
  })

  it('should call onChange when file changes', async () => {
    const onChange = vi.fn<Listener>((event, path) => {
      console.log(event, path)
      // expect(event).toBe('add')
      // expect(path).toBe(filePath)
    })

    watcher = watchFile(watchPath, onChange)

    // 等待 chokidar 初始化完成
    await sleep()

    // 修改文件内容触发 change 事件
    await fs.outputFile(filePath, 'updated content')

    // 等待事件触发
    await sleep()

    expect(onChange).toHaveBeenCalled()
  })
})
