const resolvedPromise: Promise<void> = Promise.resolve()

type Job = () => void

const jobQueue = new Set<Job>()
const deferredJobQueue = new Set<Job>()
let isFlushing = false
let isFlushPending = false
let flushedJobs: Set<Job> | undefined
let currentFlushPromise: Promise<void> | undefined

function flushJobs(): void | Promise<void> {
  isFlushPending = false
  isFlushing = true
  flushedJobs = new Set()
  let shouldFlushDeferred = false
  try {
    jobQueue.forEach((job) => {
      flushedJobs?.add(job)
      job()
    })
  }
  finally {
    jobQueue.clear()
    flushedJobs = undefined
    isFlushing = false
    if (deferredJobQueue.size) {
      deferredJobQueue.forEach(job => jobQueue.add(job))
      deferredJobQueue.clear()
      isFlushPending = true
      shouldFlushDeferred = true
    }
  }
  if (shouldFlushDeferred) {
    return resolvedPromise.then(flushJobs)
  }
}

function queueFlush() {
  const previousFlushPromise = currentFlushPromise ?? resolvedPromise
  const flushPromise = previousFlushPromise
    .then(flushJobs)
  currentFlushPromise = flushPromise
  const clearCurrentFlushPromise = () => {
    if (currentFlushPromise === flushPromise) {
      currentFlushPromise = undefined
    }
  }
  void flushPromise.then(clearCurrentFlushPromise, clearCurrentFlushPromise)
}

export function queueJob(job: Job) {
  if (isFlushing && flushedJobs?.has(job)) {
    deferredJobQueue.add(job)
    return
  }
  jobQueue.add(job)
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    queueFlush()
  }
}

export function nextTick<T>(fn?: () => T): Promise<T> {
  const promise = currentFlushPromise ?? resolvedPromise
  return fn ? promise.then(fn) : (promise as unknown as Promise<T>)
}
