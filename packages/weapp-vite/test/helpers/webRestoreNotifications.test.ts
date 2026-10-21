import { EventEmitter } from 'node:events'
import { expect, it } from 'vitest'
import { createWebRestoreNotifications } from './webRestoreNotifications'
import { createBarrier } from './webRestoreScanGate'

it('acknowledges each native notification after its own environments finish despite reversed completion', async () => {
  const notifications = createWebRestoreNotifications()
  const watcher = new EventEmitter()
  const createStarted = createBarrier()
  const releaseCreate = createBarrier()
  const completed: string[] = []
  watcher.on('add', () => {
    void notifications.hotUpdateEnvironments(async () => {
      await Promise.all([
        Promise.resolve(),
        (async () => {
          createStarted.release()
          await releaseCreate.promise
        })(),
      ])
    })
  })
  watcher.on('change', () => {
    void notifications.hotUpdateEnvironments(() => Promise.resolve())
  })
  try {
    const create = notifications.native('restored.vue', 'add', () => {
      watcher.emit('add')
    })
      .then(() => { completed.push('create') })
    await createStarted.promise
    await notifications.native('restored.vue', 'change', () => {
      watcher.emit('change')
    })
      .then(() => { completed.push('update') })
    expect(completed).toEqual(['update'])
    releaseCreate.release()
    await create
    expect(completed).toEqual(['update', 'create'])
  }
  finally {
    releaseCreate.release()
    notifications.close()
  }
})

it('waits for the matching synthetic watchChange and the host publication without consuming a native completion', async () => {
  const notifications = createWebRestoreNotifications()
  const sourceStarted = createBarrier()
  const releaseSource = createBarrier()
  const unrelatedFinished = createBarrier()
  let acknowledged = false
  let published = false
  let publishing: Promise<void> | undefined
  try {
    const source = notifications.source('restored.vue', 'add', () => {
      publishing = (async () => {
        await notifications.watchChange('unrelated.vue', { event: 'create' }, () => Promise.resolve())
        await notifications.watchChange('restored.vue', { event: 'delete' }, () => Promise.resolve())
        await notifications.hotUpdateEnvironments(() => Promise.resolve())
        unrelatedFinished.release()
        await notifications.watchChange('restored.vue', { event: 'create' }, async () => {
          sourceStarted.release()
          await releaseSource.promise
        })
        published = true
      })()
    }).then(() => { acknowledged = true })
    await unrelatedFinished.promise
    await sourceStarted.promise
    expect(acknowledged).toBe(false)
    releaseSource.release()
    await source
    expect(published).toBe(true)
    await publishing
  }
  finally {
    releaseSource.release()
    notifications.close()
  }
})
