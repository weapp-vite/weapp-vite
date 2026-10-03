import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const symbol = 'globalThis[Symbol.for("weapp-vite.ignored.native-notification")]'
const hash = value => createHash('sha256').update(value).digest('hex')
const windows = []
const transport = []
const devs = []
const handles = new Map()
let stopping = false
let active
let command = 0
let transportOverflow = false

async function inspect(url, expression) {
  const socket = new WebSocket(url)
  let timer
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Diagnostic inspector open timed out')), 15_000)
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', () => reject(new Error('Diagnostic inspector open failed')), { once: true })
    })
    clearTimeout(timer)
    const id = ++command
    const start = performance.now()
    const value = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Diagnostic inspector command timed out')), 15_000)
      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data))
          if (payload.id !== id) {
            return
          }
          if (payload.error || payload.result?.exceptionDetails) {
            return reject(new Error(JSON.stringify(payload.error ?? payload.result.exceptionDetails)))
          }
          resolve(payload.result?.result?.value)
        }
        catch (error) {
          reject(error)
        }
      })
      socket.addEventListener('error', () => reject(new Error('Diagnostic inspector command failed')), { once: true })
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
    })
    const end = performance.now()
    assert(value && typeof value.now === 'number')
    return { remote: value, driverStart: start, driverEnd: end, offsetLower: value.now - end, offsetUpper: value.now - start, roundTripMs: end - start }
  }
  finally {
    clearTimeout(timer)
    socket.close()
  }
}

export function registerDev(dev) {
  handles.set(dev.pid, dev)
  devs.push({ pid: dev.pid, registeredAt: performance.now(), stopped: false })
}
export function stoppedDev(dev) {
  const record = devs.find(item => item.pid === dev.pid)
  assert(record)
  record.stopped = true
  record.stoppedAt = performance.now()
  handles.delete(dev.pid)
}
export function recordTransport(event, phase) {
  if (transport.length === 20_000) {
    transportOverflow = true
    return
  }
  transport.push({ ...event, phase, observationWindow: active?.id ?? null, at: performance.now() })
}
export async function beginMutation(inspectorUrl, scenario, cycle, phase, content) {
  if (scenario.group !== 'native-script') {
    return null
  }
  assert(!active)
  const id = `${scenario.id}:${cycle}:${phase}`
  const record = { id, phase, cycle, inputHash: hash(content), inspectorUrl, file: scenario.sourceFile }
  record.calibration = await inspect(inspectorUrl, `${symbol}.activate(${JSON.stringify({ id, phase, cycle, inputHash: record.inputHash, file: record.file })})`)
  windows.push(record)
  active = record
  return id
}
export async function observedWrite(id, run) {
  if (id === null) {
    return run()
  }
  assert.equal(active?.id, id)
  active.writeBegin = performance.now()
  try {
    return await run()
  }
  finally {
    active.writeEnd = performance.now()
  }
}
export async function finishMutation(id, sample, distRoot, readOutput) {
  if (id === null) {
    return
  }
  assert.equal(active?.id, id)
  const record = active
  record.finishCalibration = await inspect(record.inspectorUrl, `${symbol}.finish(${JSON.stringify(id)})`)
  active = undefined
  record.sample = sample
  record.visibleOutput = await readOutput()
  const files = {}
  for (const entry of await readdir(distRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const filename = path.join(entry.parentPath, entry.name)
    const bytes = await readFile(filename)
    files[path.relative(distRoot, filename).replaceAll('\\', '/')] = { hash: hash(bytes), bytes: bytes.length, base64: bytes.toString('base64') }
  }
  record.artifacts = files
}
export async function finalizeScenario(scenario, inspectorUrl, reportRoot, failure) {
  if (scenario.group !== 'native-script') {
    return
  }
  if (active) {
    active.incomplete = true
    active.finishCalibration = await inspect(inspectorUrl, `${symbol}.finish(${JSON.stringify(active.id)})`)
    active = undefined
  }
  await mkdir(reportRoot, { recursive: true })
  const redactedWindows = windows.map(({ inspectorUrl: _inspector, file, ...record }) => ({ ...record, file: path.relative(process.env.TEMPLATES_HMR_WORKSPACE_ROOT, file).replaceAll('\\', '/') }))
  await writeFile(path.join(reportRoot, 'driver-events.json'), `${JSON.stringify({ diagnosticOnly: true, timeOrigin: performance.timeOrigin, failure: failure?.error ?? null, transportOverflow, devs, windows: redactedWindows, transport }, null, 2)}\n`, { flag: 'wx' })
}
export async function saveLifecycle(reportRoot) {
  await writeFile(path.join(reportRoot, 'driver-lifecycle.json'), `${JSON.stringify({ devs }, null, 2)}\n`, { flag: 'wx' })
}

async function stopOwnedOnSignal() {
  if (stopping) {
    return
  }
  stopping = true
  process.exitCode = 143
  for (const dev of [...handles.values()]) {
    try {
      await dev.stop(5_000)
      stoppedDev(dev)
    }
    catch (error) {
      process.stderr.write(`[native-notification:cleanup-error] ${String(error?.message ?? error)}\n`)
    }
  }
}
process.once('SIGTERM', stopOwnedOnSignal)
process.once('SIGINT', stopOwnedOnSignal)
