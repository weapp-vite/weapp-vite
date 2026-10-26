import { Buffer } from 'node:buffer'

function repositoryParts(repository) {
  if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${repository}`)
  }
  const [owner, name] = repository.split('/')
  return { owner, name }
}

function encodePath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export function createGitHubClient({ token, repository, fetchImpl = fetch }) {
  repositoryParts(repository)
  async function request(path, options = {}, targetRepository = repository) {
    const target = repositoryParts(targetRepository)
    const response = await fetchImpl(`https://api.github.com/repos/${target.owner}/${target.name}${path}`, {
      ...options,
      signal: AbortSignal.timeout(30_000),
      headers: {
        'accept': 'application/vnd.github+json',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
        ...(options.headers ?? {}),
      },
    })
    const text = await response.text()
    let body
    try {
      body = text ? JSON.parse(text) : undefined
    }
    catch {
      body = text
    }
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status} ${options.method ?? 'GET'} ${path}: ${typeof body === 'string' ? body : body?.message ?? 'request failed'}`)
    }
    return body
  }
  return {
    repository,
    getPullRequest: number => request(`/pulls/${number}`),
    getPullRequestFiles: async (number) => {
      const files = []
      for (let page = 1; ; page++) {
        const pageFiles = await request(`/pulls/${number}/files?per_page=100&page=${page}`)
        files.push(...pageFiles)
        if (files.length >= 3000) {
          throw new Error('PR file list may be truncated; add a manual changeset')
        }
        if (pageFiles.length < 100) {
          return files
        }
      }
    },
    getContent: async (path, ref) => {
      try {
        const content = await request(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`)
        if (Array.isArray(content) || content.type !== 'file' || content.encoding !== 'base64' || typeof content.content !== 'string') {
          throw new Error(`Cannot read complete file content: ${path}; add a manual changeset`)
        }
        return Buffer.from(content.content.replace(/\n/g, ''), 'base64').toString('utf8')
      }
      catch (error) {
        if (String(error.message).startsWith('GitHub API 404')) {
          return undefined
        }
        throw error
      }
    },
    getRef: (ref, targetRepository = repository) => request(`/git/ref/${encodePath(ref)}`, {}, targetRepository),
    getTree: async (sha) => {
      const tree = await request(`/git/trees/${sha}?recursive=1`)
      if (tree.truncated || !Array.isArray(tree.tree)) {
        throw new Error('Workspace tree is truncated; add a manual changeset')
      }
      return tree.tree.filter(entry => entry.type === 'blob' && ['100644', '100755'].includes(entry.mode)).map(entry => entry.path)
    },
    getCommit: sha => request(`/git/commits/${sha}`),
    createBlob: content => request('/git/blobs', { method: 'POST', body: JSON.stringify({ content, encoding: 'utf-8' }) }),
    createTree: (baseTree, tree) => request('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) }),
    createCommit: (message, tree, parents) => request('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree, parents }) }),
    updateRef: (ref, sha) => request(`/git/refs/heads/${encodePath(ref)}`, { method: 'PATCH', body: JSON.stringify({ sha, force: false }) }),
    createComment: (number, body) => request(`/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    listComments: async (number) => {
      const comments = []
      for (let page = 1; ; page++) {
        const pageComments = await request(`/issues/${number}/comments?per_page=100&page=${page}`)
        comments.push(...pageComments)
        if (pageComments.length < 100) {
          return comments
        }
      }
    },
  }
}
