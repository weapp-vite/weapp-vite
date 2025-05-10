import type { FSWatcher } from 'chokidar'
import type { EventName } from 'chokidar/handler.js'
import fs from 'node:fs'
import { join } from 'node:path'
import chokidar from 'chokidar'
import mockFs from 'mock-fs'

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
  const filePath = join(__dirname, 'test.txt')
  let watcher: FSWatcher

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
    const onChange = vi.fn<Listener>((event, path, stats) => {
      console.log(event, path, stats)
      expect(event).toBe('add')
    })

    watcher = watchFile(filePath, onChange)

    // 等待 chokidar 初始化完成
    await sleep()

    // 修改文件内容触发 change 事件
    fs.writeFileSync(filePath, 'updated content')

    // 等待事件触发
    await sleep()

    expect(onChange).toHaveBeenCalled()
  })
})
