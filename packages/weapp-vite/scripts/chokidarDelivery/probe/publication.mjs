import assert from 'node:assert/strict'
import path from 'node:path'
import { matchesOutput, waitForFile } from './fixture.mjs'

/** 只有真实发布回调现场的输出才可完成本次变更，旧回调不能借用后续构建的字节。 */
export function createPublicationObserver(outDir, readOutput = matchesOutput) {
  let sequence = 0
  let pending
  return {
    expectOutput(relative, expected) {
      assert.equal(pending, undefined, 'An artifact owner can observe only one mutation at a time')
      let resolve
      let reject
      const completed = new Promise((resolve_, reject_) => {
        resolve = resolve_
        reject = reject_
      })
      // 变更尚未返回时回调也可能完成；立即安装拒绝处理，随后仍传播原始错误。
      completed.catch(() => {})
      const ticket = { after: sequence, relative, expected, resolve, reject }
      pending = ticket
      return {
        completed,
        describe: () => ({ after: ticket.after, observed: sequence }),
        dispose() {
          if (pending === ticket) {
            pending = undefined
          }
        },
      }
    },
    async onRebuilt(artifact) {
      const observed = ++sequence
      const ticket = pending
      if (!ticket || observed <= ticket.after) {
        return
      }
      try {
        assert.equal(path.resolve(artifact.miniprogramRootPath), path.resolve(outDir))
        const matched = await readOutput(path.join(outDir, ticket.relative), ticket.expected)
        if (pending === ticket && matched) {
          pending = undefined
          ticket.resolve()
        }
      }
      catch (error) {
        if (pending === ticket) {
          pending = undefined
          ticket.reject(error)
        }
        throw error
      }
    },
  }
}

/** 先登记变更，再等待自然发布及对应输出；同一阶段共用原有四十五秒上限。 */
export async function mutateAndAssertOutputs(owners, relative, expected, mutate, phase) {
  const deadline = Date.now() + 45_000
  const controller = new AbortController()
  const tickets = []
  let timeout
  try {
    for (const owner of owners) {
      if (owner.kind === 'artifact') {
        assert.equal(typeof owner.publications?.expectOutput, 'function', 'Artifact mutations require their natural publication observer')
        tickets.push(owner.publications.expectOutput(relative, expected))
      }
      else {
        assert.equal(owner.kind, 'host')
        tickets.push(undefined)
      }
    }
    const completed = (async () => {
      await mutate()
      await Promise.all(owners.map((owner, index) => tickets[index]
        ? tickets[index].completed
        : waitForFile(path.join(owner.outDir, relative), expected, { deadline, signal: controller.signal })))
    })()
    await Promise.race([completed, new Promise((_resolve, reject) => {
      timeout = setTimeout(() => {
        const publications = tickets.map(ticket => ticket?.describe() ?? { provider: 'host' })
        reject(new Error(`Timed out: ${phase} public publication; output=${relative}; expected=${JSON.stringify(expected)}; publications=${JSON.stringify(publications)}`))
      }, Math.max(0, deadline - Date.now()))
    })])
  }
  finally {
    clearTimeout(timeout)
    controller.abort()
    for (const ticket of tickets) {
      ticket?.dispose()
    }
  }
}
