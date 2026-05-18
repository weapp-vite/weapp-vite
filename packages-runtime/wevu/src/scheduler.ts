const resolvedPromise: Promise<void> = Promise.resolve()

type Job = () => void

const jobQueue = new Set<Job>()
const deferredJobQueue = new Set<Job>()
let isFlushing = false
let isFlushPending = false
let flushedJobs: Set<Job> | undefined

function flushJobs() {
  isFlushPending = false
  isFlushing = true
  flushedJobs = new Set()
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
      if (!isFlushPending) {
        isFlushPending = true
        resolvedPromise.then(flushJobs)
      }
    }
  }
}

export function queueJob(job: Job) {
  if (isFlushing && flushedJobs?.has(job)) {
    deferredJobQueue.add(job)
    return
  }
  jobQueue.add(job)
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    resolvedPromise.then(flushJobs)
  }
}

export function nextTick<T>(fn?: () => T): Promise<T> {
  return fn ? resolvedPromise.then(fn) : (resolvedPromise as unknown as Promise<T>)
}
