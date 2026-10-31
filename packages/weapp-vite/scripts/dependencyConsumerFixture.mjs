import assert from 'node:assert/strict'

/** 消费者只安装公开入口；完整候选闭包仍由包管理器覆盖解析。 */
export function createDependencyConsumerManifest(candidates, consumerPeers, manager) {
  assert(['pnpm', 'npm'].includes(manager), 'Unsupported dependency consumer manager')
  const entries = ['weapp-vite', 'wevu', ...('@weapp-vite/react' in candidates ? ['@weapp-vite/react'] : [])]
  const dependencies = Object.fromEntries(entries.map((name) => {
    assert(typeof candidates[name] === 'string', `Missing packed entry: ${name}`)
    return [name, candidates[name]]
  }))
  return {
    name: 'weapp-vite-host-dependency-compatibility',
    private: true,
    type: 'module',
    dependencies: { ...dependencies, typescript: '6.0.3' },
    devDependencies: consumerPeers,
    ...(manager === 'npm'
      ? { overrides: Object.fromEntries(Object.entries(candidates).map(([name, archive]) => [name, name in dependencies ? `$${name}` : archive])) }
      : {}),
  }
}
