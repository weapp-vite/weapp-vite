const gitChangelog = require('@changesets/changelog-git')
const githubChangelog = require('@icebreakers/changelog-github')

const github = githubChangelog.default || githubChangelog
const git = gitChangelog.default || gitChangelog

function shouldFallback(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /Failed to parse data from GitHub|api\.github\.com\/graphql|Premature close|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(message)
}

async function withGithubFallback(action, fallback, label) {
  try {
    return await action()
  }
  catch (error) {
    if (!shouldFallback(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[changeset-changelog] GitHub changelog lookup failed for ${label}; falling back to git changelog. ${message}`)
    return await fallback()
  }
}

async function getReleaseLine(changeset, type, options) {
  return await withGithubFallback(
    () => github.getReleaseLine(changeset, type, options),
    () => git.getReleaseLine(changeset, type, options),
    'release line',
  )
}

async function getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
  return await withGithubFallback(
    () => github.getDependencyReleaseLine(changesets, dependenciesUpdated, options),
    () => git.getDependencyReleaseLine(changesets, dependenciesUpdated, options),
    'dependency release line',
  )
}

module.exports = {
  getDependencyReleaseLine,
  getReleaseLine,
}
