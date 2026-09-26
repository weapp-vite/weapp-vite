import process from 'node:process'

export async function request(endpoint, body, method) {
  const response = await fetch(`${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${process.env.GITHUB_REPOSITORY}${endpoint}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'authorization': `Bearer ${process.env.GITHUB_TOKEN}`, 'accept': 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${endpoint}`)
  }
  return response.json()
}

export async function pages(endpoint, get = request) {
  const all = []
  for (let page = 1; ; page++) {
    const rows = await get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    if (!Array.isArray(rows)) {
      throw new TypeError('Invalid GitHub paginated response')
    }
    all.push(...rows)
    if (rows.length < 100) {
      return all
    }
  }
}
