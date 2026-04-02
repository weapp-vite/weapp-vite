let attachCount = 0

export function resetIssue385AttachCount() {
  attachCount = 0
}

export function increaseIssue385AttachCount() {
  attachCount += 1
  return attachCount
}

export function getIssue385AttachCount() {
  return attachCount
}
