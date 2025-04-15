import { touch } from '@/utils/file'
import chokidar from 'chokidar'
import { watch } from 'fs-extra'
import path from 'pathe'

describe.sequential('fs-watch', () => {
  it('touch', async () => {
    let count = 0
    const watchFile = path.resolve(__dirname, './fixtures/touch/index.js')
    const fsWatcher = watch(watchFile, (eventType, filename) => {
      expect(eventType).toBe('change')
      expect(filename).toBe('index.js')
      count++
    })
    await touch(watchFile)
    expect(count).toBe(1)
    // await new Promise(resolve => setTimeout(resolve, 100))
    // touchSync(watchFile)
    // expect(count).toBe(2)
    fsWatcher.close()
  })

  it.skip('touchSync', async () => {
    // let count = 0
    const watchFile = path.resolve(__dirname, './fixtures/touch/c.js')
    const fsWatcher = chokidar.watch(watchFile).on('all', (eventType, filename) => {
      console.log(eventType, filename)
      // if(eventType )
      // expect(eventType).toBe('add')
      // expect(filename).toBe('x.js')
      // count++
    })

    // touchSync(watchFile)
    // expect(count).toBe(1)
    // await process.nextTick(() => {
    //   expect(count).toBe(1)
    // })

    fsWatcher.close()
  })
})
