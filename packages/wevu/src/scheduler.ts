const resolvedPromise: Promise<void> = Promise.resolve()

type Job = () => void

const jobQueue = new Set<Job>()
let isFlushing = false
let isFlushPending = false

function flushJobs() {
  isFlushPending = false
  isFlushing = true
  try {
    jobQueue.forEach(job => job())
  }
  finally {
    jobQueue.clear()
    isFlushing = false
  }
}

export function queueJob(job: Job) {
  jobQueue.add(job)
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    resolvedPromise.then(flushJobs)
  }
}

export function nextTick<T>(fn?: () => T): Promise<T> {
  return fn ? resolvedPromise.then(fn) : (resolvedPromise as unknown as Promise<T>)
}
