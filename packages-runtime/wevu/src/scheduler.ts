const resolvedPromise: Promise<void> = Promise.resolve()

type Job = () => void | PromiseLike<void>

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
  let hasError = false
  let firstError: unknown
  const pendingJobs: PromiseLike<void>[] = []
  try {
    jobQueue.forEach((job) => {
      flushedJobs?.add(job)
      try {
        const result = job()
        if (result && typeof result.then === 'function') {
          pendingJobs.push(result)
        }
      }
      catch (error) {
        if (!hasError) {
          hasError = true
          firstError = error
        }
      }
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
  if (pendingJobs.length || shouldFlushDeferred) {
    return Promise.all(pendingJobs)
      .then(() => shouldFlushDeferred ? flushJobs() : undefined)
      .then(
        () => {
          if (hasError) {
            throw firstError
          }
        },
        (error: unknown) => {
          throw hasError ? firstError : error
        },
      )
  }
  if (hasError) {
    throw firstError
  }
}

function queueFlush() {
  const flushPromise = resolvedPromise.then(flushJobs)
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
