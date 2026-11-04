import { createGitHubClient } from '../collect/github'

/** 缓存公开 API 响应；认证交给 gh，不读取或持久化凭据。 */
export async function githubJson<T>(endpoint: string, cacheDir: string): Promise<T> {
  return await createGitHubClient({ cacheDir, attempts: 6 }).json(endpoint) as T
}
