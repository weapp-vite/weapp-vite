/**
 * 为发布包消费 runtime 注入统一的严格 DOM 验收环境。
 *
 * 这些用例必须把运行时证据当作门禁；否则 Vitest 仍可能在遗漏
 * checkpoint 或未分类宿主错误时以零退出码完成。
 */
export function createConsumerRuntimeEnvironment(provider, compilerHost, projectVariable, projectRoot) {
  return {
    WEAPP_VITE_E2E_RUNTIME_PROVIDER: provider,
    WEAPP_VITE_E2E_COMPILER_HOST: compilerHost,
    WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1',
    [projectVariable]: projectRoot,
  }
}
