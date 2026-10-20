import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { bounded } from './native.mjs'
import { assertOutput, closeOwner, openPublicOwner } from './public.mjs'

export const scenarios = [
  { id: 'public-missing-watch-recovery', kind: 'recovery', platform: 'win32' },
  { id: 'public-still-exists-watch-error', kind: 'error', missing: false },
  { id: 'public-non-windows-missing-watch-error', kind: 'error', missing: true, exclude: 'win32' },
  { id: 'shared-test-first', kind: 'shared', first: 'artifact' },
  { id: 'shared-host-first', kind: 'shared', first: 'host' },
]

export function nonApplicableReason(scenario, platform) {
  if (scenario.platform && scenario.platform !== platform) {
    return 'Missing-directory EPERM recovery requires an actual Windows public-entry worker; process.platform is never spoofed.'
  }
  if (scenario.exclude === platform) {
    return 'This negative classification boundary applies only on a non-Windows host.'
  }
}

async function waitForNativeHandle(instrumentation, target) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const handles = instrumentation.handles.filter(item => item.file === target)
    if (handles.length) {
      return handles
    }
    await delay(10)
  }
  assert.fail('The public owner did not acquire the target native directory handle')
}

/** 两个公开 owner 必须共享同一原生 acquisition，先关闭者不能释放幸存者的资源。 */
async function shared(ctx) {
  const { scenario, root, owners, errors, instrumentation, evidence } = ctx
  const target = path.join(root, 'src/shared')
  const first = await openPublicOwner(scenario.first, root, owners, errors)
  await assertOutput(first, 'shared/marker.txt', 'before-shared-mutation')
  const initial = await waitForNativeHandle(instrumentation, target)
  assert.equal(initial.length, 1, 'The first public owner must acquire one exact directory handle')
  const attemptsBefore = instrumentation.attempts.filter(file => file === 'src/shared').length
  const second = await openPublicOwner(scenario.first === 'artifact' ? 'host' : 'artifact', root, owners, errors)
  await assertOutput(second, 'shared/marker.txt', 'before-shared-mutation')
  const handles = instrumentation.handles.filter(item => item.file === target)
  assert.equal(handles.length, 1, 'Two public entry graphs must share the native Chokidar subscription')
  assert.equal(instrumentation.attempts.filter(file => file === 'src/shared').length, attemptsBefore, 'The second entry must reuse the existing native registration')
  const marker = path.join(target, 'marker.txt')
  await writeFile(marker, 'both-public-owners')
  for (const owner of [first, second]) {
    await assertOutput(owner, 'shared/marker.txt', 'both-public-owners')
  }
  await closeOwner(first)
  assert.equal(initial[0].closeCalls, 0, 'First owner close cannot close the survivor native handle')
  assert.equal(initial[0].closeEvents, 0)
  await writeFile(marker, 'surviving-public-owner')
  await assertOutput(second, 'shared/marker.txt', 'surviving-public-owner')
  await closeOwner(second)
  await bounded(initial[0].closed, 'shared directory native close event')
  assert.equal(initial[0].closeCalls, 1)
  assert.equal(initial[0].closeEvents, 1)
  assert.deepEqual(errors, [])
  Object.assign(evidence, { first: first.kind, survivor: second.kind, nativeAcquisitions: 1, firstCloseReleased: false, survivorEmitted: true, lastCloseCalls: initial[0].closeCalls, lastCloseEvents: initial[0].closeEvents })
}

/** 错误注入发生在初次公开入口注册时，原始 Error 身份是失败边界的一部分。 */
async function errorBoundary(ctx) {
  const { root, owners, errors, instrumentation, injectedError, evidence } = ctx
  await assert.rejects(openPublicOwner('artifact', root, owners, errors), error => error === injectedError)
  assert.equal(instrumentation.injected, 1, 'The exact native target must be injected once')
  assert.equal(errors.filter(error => error === injectedError).length, 1, 'The public onError must preserve original Error identity')
  assert(errors.every(error => error === injectedError), 'Unexpected errors cannot be normalized away')
  Object.assign(evidence, { injectedOnce: true, rejectionPreservedOriginal: true, onErrorPreservedOriginal: true })
}

async function recovery(ctx) {
  const { root, owners, errors, instrumentation, injectedError, evidence } = ctx
  const owner = await openPublicOwner('artifact', root, owners, errors)
  assert.equal(instrumentation.injected, 1, 'Recovery must actually exercise one failed native acquisition')
  const reborn = path.join(root, 'src/reborn')
  await mkdir(reborn)
  await writeFile(path.join(reborn, 'marker.txt'), 'recreated-directory')
  await assertOutput(owner, 'reborn/marker.txt', 'recreated-directory')
  await writeFile(path.join(reborn, 'marker.txt'), 'changed-after-recovery')
  await assertOutput(owner, 'reborn/marker.txt', 'changed-after-recovery')
  await rm(path.join(reborn, 'marker.txt'))
  await assertOutput(owner, 'reborn/marker.txt', null)
  Object.assign(evidence, { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true })
  // 负控可能完成输出恢复后才公开原始错误；只透传精确单例，其他失败仍保留断言。
  if (errors.length === 1 && errors[0] === injectedError) {
    throw injectedError
  }
  assert.deepEqual(errors, [])
}

export async function exerciseScenario(ctx) {
  if (ctx.scenario.kind === 'shared') {
    await shared(ctx)
  }
  else if (ctx.scenario.kind === 'recovery') {
    await recovery(ctx)
  }
  else {
    await errorBoundary(ctx)
  }
}
