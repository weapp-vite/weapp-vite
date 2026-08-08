# Issue #724 Reproduction

此 fixture 来自 `Airkro/weapp-vite-bug` 仓库的 `bug-9` 分支，保留了触发问题的关键组合：

- Vue SFC 页面
- `autoRoutes`
- `glass-easel`
- `<style src="vant/es/space/index.css">` 裸包样式路径

对应回归测试位于 `e2e/ci/issue-724-sfc-style-src.test.ts`。
