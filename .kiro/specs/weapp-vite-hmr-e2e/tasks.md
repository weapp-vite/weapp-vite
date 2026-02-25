# Implementation Plan: weapp-vite HMR E2E 测试

## Overview

基于现有 `wevu-runtime.hmr.test.ts` 的模式，扩展 HMR 端到端测试覆盖五种文件类型（模板、样式、脚本、JSON、Vue SFC）的三种操作（修改、新增、删除），并扩展 CI 矩阵支持多操作系统。新增连续快速修改、app.json 配置修改、组件级新增/删除、文件重命名、HTML 模板文件等场景的测试覆盖。实现语言为 TypeScript，测试框架为 Vitest。

## Tasks

- [x] 1. 创建 HMR 测试工具模块和测试源文件
  - [x] 1.1 创建 `e2e/utils/hmr-helpers.ts` 工具模块
    - 从 `wevu-runtime.hmr.test.ts` 中提取 `waitForFileContains`、`resolvePlatforms`、`PLATFORM_EXT`、`SUPPORTED_PLATFORMS` 等到独立模块
    - 新增 `waitForFileRemoved` 函数，轮询检测文件是否被删除
    - 新增 `createHmrMarker(prefix, platform)` 生成唯一标记字符串
    - 导出 `PLATFORM_EXT` 映射（含 template 和 style 扩展名）
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.2 创建 Vue SFC HMR 测试页面 `e2e-apps/wevu-runtime-e2e/src/pages/hmr-sfc/index.vue`
    - 包含 template、script、style 三个部分，内容含可识别标记
    - 在 `e2e-apps/wevu-runtime-e2e/src/app.json` 的 pages 数组中注册 `pages/hmr-sfc/index`
    - _Requirements: 5.1, 5.2, 5.3, 10.1_

  - [ ]\* 1.3 编写 `hmr-helpers.ts` 的单元测试
    - 测试 `createHmrMarker` 生成唯一标记
    - 测试 `resolvePlatforms` 在有/无 `E2E_PLATFORM` 环境变量时的行为
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.4 创建 HTML 模板 HMR 测试页面 `e2e-apps/wevu-runtime-e2e/src/pages/hmr-html/`
    - 创建 `index.html`（使用 .html 作为模板扩展名，内容含可识别标记）
    - 创建 `index.ts`、`index.wxss`、`index.json`
    - 在 `e2e-apps/wevu-runtime-e2e/src/app.json` 的 pages 数组中注册 `pages/hmr-html/index`
    - _Requirements: 16.1, 16.2, 10.1_

- [x] 2. 实现修改操作 HMR 测试
  - [x] 2.1 创建 `e2e/ci/hmr-modify.test.ts` — 页面级文件修改测试
    - 使用 `describe.sequential` + `it.each(platforms)` 模式
    - 实现修改 `.wxml` 模板文件测试：修改源文件插入标记 → 验证 dist 中对应平台模板文件包含标记
    - 实现修改 `.wxss` 样式文件测试：修改源文件插入标记 → 验证 dist 中对应平台样式文件包含标记
    - 实现修改 `.ts` 脚本文件测试：修改源文件插入标记 → 验证 dist 中 `.js` 文件包含编译后标记
    - 实现修改 `.json` 配置文件测试：修改源文件插入标记 → 验证 dist 中 `.json` 文件包含标记
    - 每个测试用例在 `finally` 块中恢复源文件到原始状态
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 10.1, 9.4_

  - [x] 2.2 在 `hmr-modify.test.ts` 中添加组件级文件修改测试
    - 实现修改 `components/x-child/index.wxml` 模板测试
    - 实现修改 `components/x-child/index.wxss` 样式测试
    - 实现修改 `components/x-child/index.ts` 脚本测试
    - 实现修改 `components/x-child/index.json` 配置测试
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 9.4_

  - [x] 2.3 在 `hmr-modify.test.ts` 中添加 Vue SFC 修改测试
    - 实现修改 `.vue` 文件 template 部分 → 验证 dist 中平台模板文件更新
    - 实现修改 `.vue` 文件 style 部分 → 验证 dist 中平台样式文件更新
    - 实现修改 `.vue` 文件 script 部分 → 验证 dist 中 `.js` 文件更新
    - _Requirements: 5.1, 5.2, 5.3, 9.4_

- [x] 3. Checkpoint — 确保修改测试通过
  - 确保所有修改操作测试通过，如有问题请向用户确认。

- [x] 4. 实现新增操作 HMR 测试
  - [x] 4.1 创建 `e2e/ci/hmr-add.test.ts` — 页面级文件新增测试
    - 使用 `pages/hmr-temp/` 作为临时目录，测试时动态创建文件
    - 实现新增 `.wxml` 模板文件测试：创建新源文件 → 验证 dist 中生成对应平台模板文件
    - 实现新增 `.wxss` 样式文件测试：创建新源文件 → 验证 dist 中生成对应平台样式文件
    - 实现新增 `.ts` 脚本文件测试：创建新源文件 → 验证 dist 中生成对应 `.js` 文件
    - 实现新增 `.json` 配置文件测试：创建新源文件 → 验证 dist 中生成对应 `.json` 文件
    - 实现新增 `.vue` SFC 文件测试：创建新源文件 → 验证 dist 中生成模板、样式、脚本文件
    - 每个测试用例在 `finally` 块中清理新增的临时文件
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.2, 10.3, 9.4_

  - [x] 4.2 在 `hmr-add.test.ts` 中添加组件级文件新增测试
    - 使用 `components/hmr-temp-comp/` 作为临时组件目录
    - 实现新增完整组件测试：创建 .wxml、.ts、.wxss、.json 四个文件 → 验证 dist 中生成对应的所有组件输出文件（平台模板、.js、平台样式、.json）
    - 实现在现有组件中新增 .wxss 样式文件测试：在已有组件目录中创建新样式文件 → 验证 dist 中生成对应平台样式文件
    - 每个测试用例在 `finally` 块中清理临时组件目录
    - _Requirements: 13.1, 13.2, 10.2, 10.3, 9.4_

- [x] 5. 实现删除操作 HMR 测试
  - [x] 5.1 创建 `e2e/ci/hmr-delete.test.ts` — 页面级文件删除测试
    - 先在源目录创建临时文件并等待 dist 生成对应输出
    - 实现删除 `.wxml` 模板文件测试：删除源文件 → 验证 dist 中对应平台模板文件被移除
    - 实现删除 `.wxss` 样式文件测试：删除源文件 → 验证 dist 中对应平台样式文件被移除
    - 实现删除 `.ts` 脚本文件测试：删除源文件 → 验证 dist 中对应 `.js` 文件被移除
    - 实现删除 `.json` 配置文件测试：删除源文件 → 验证 dist 中对应 `.json` 文件被移除
    - 实现删除 `.vue` SFC 文件测试：删除源文件 → 验证 dist 中模板、样式、脚本文件均被移除
    - 每个测试用例在 `finally` 块中恢复源文件到原始状态
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.2, 10.3, 9.4_

  - [x] 5.2 在 `hmr-delete.test.ts` 中添加组件级文件删除测试
    - 使用 `components/hmr-temp-comp/` 作为临时组件目录
    - 先创建临时组件文件并等待 dist 生成对应输出
    - 实现删除组件 .wxml 模板文件测试：删除源文件 → 验证 dist 中对应平台模板文件被移除
    - 实现删除组件 .wxss 样式文件测试：删除源文件 → 验证 dist 中对应平台样式文件被移除
    - 每个测试用例在 `finally` 块中清理临时组件目录
    - _Requirements: 14.1, 14.2, 10.2, 10.3, 9.4_

- [x] 6. Checkpoint — 确保新增和删除测试通过
  - 确保所有新增和删除操作测试通过，如有问题请向用户确认。

- [x] 7. 实现连续快速修改 HMR 测试
  - [x] 7.1 创建 `e2e/ci/hmr-rapid.test.ts` — 连续快速修改测试
    - 使用 `describe.sequential` + `it.each(platforms)` 模式
    - 实现连续快速修改 `.wxml` 模板文件测试：对同一文件连续执行两次修改（间隔小于 1 秒），第一次插入 `HMR-RAPID-FIRST` 标记，第二次插入 `HMR-RAPID-SECOND` 标记 → 验证 dist 最终仅包含第二次标记
    - 实现连续快速修改 `.ts` 脚本文件测试：同上模式，验证编译后 .js 文件仅包含第二次标记
    - 实现连续快速修改 `.vue` SFC 文件测试：同上模式，验证 dist 中模板文件仅包含第二次标记
    - 每个测试用例在 `finally` 块中恢复源文件到原始状态
    - _Requirements: 11.1, 11.2, 11.3, 9.4_

  - [ ]\* 7.2 编写连续快速修改的属性测试
    - **Property 1: 连续快速修改最终一致性**
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 8. 实现 app.json 配置修改 HMR 测试
  - [x] 8.1 创建 `e2e/ci/hmr-app-config.test.ts` — app.json 配置修改测试
    - 使用 `describe.sequential` + `it.each(platforms)` 模式
    - 实现修改 app.json window 配置测试：修改 window 配置项插入标记 → 验证 dist/app.json 包含修改后的配置值
    - 实现修改 app.json pages 数组测试：先创建新页面源文件，再向 pages 数组新增页面路径 → 验证 dist/app.json 包含新页面路径，且 dist 中生成新页面的输出文件
    - 每个测试用例在 `finally` 块中恢复 app.json 到原始状态并清理临时页面文件
    - _Requirements: 12.1, 12.2, 9.4_

  - [ ]\* 8.2 编写 app.json 配置修改的属性测试
    - **Property 2: app.json window 配置修改传播**
    - **Property 3: app.json pages 数组修改触发页面生成**
    - **Validates: Requirements 12.1, 12.2**

- [x] 9. 实现文件重命名 HMR 测试
  - [x] 9.1 创建 `e2e/ci/hmr-rename.test.ts` — 文件重命名测试
    - 使用 `describe.sequential` + `it.each(platforms)` 模式
    - 使用 `pages/hmr-rename-temp/` 作为临时目录，测试前创建源文件并等待 dist 生成
    - 实现重命名 `.wxml` 模板文件测试：将源文件重命名 → 验证 dist 中旧文件名对应的平台模板文件被移除，新文件名对应的平台模板文件被生成
    - 实现重命名 `.ts` 脚本文件测试：将源文件重命名 → 验证 dist 中旧文件名对应的 .js 文件被移除，新文件名对应的 .js 文件被生成
    - 每个测试用例在 `finally` 块中清理临时目录
    - _Requirements: 15.1, 15.2, 9.4_

  - [ ]\* 9.2 编写文件重命名的属性测试
    - **Property 6: 文件重命名等价于删除旧文件加创建新文件**
    - **Validates: Requirements 15.1, 15.2**

- [x] 10. 实现 HTML 模板文件 HMR 测试
  - [x] 10.1 创建 `e2e/ci/hmr-html-template.test.ts` — HTML 模板文件测试
    - 使用 `describe.sequential` + `it.each(platforms)` 模式
    - 实现修改 `.html` 模板文件测试：修改 `pages/hmr-html/index.html` 插入标记 → 验证 dist 中对应平台模板文件包含标记（.html 在 dist 中输出为平台模板扩展名）
    - 实现新增 `.html` 模板文件测试：在临时目录创建新 .html 文件 → 验证 dist 中生成对应平台模板文件
    - 每个测试用例在 `finally` 块中恢复源文件到原始状态
    - _Requirements: 16.1, 16.2, 9.4_

  - [ ]\* 10.2 编写 HTML 模板文件的属性测试
    - **Property 7: HTML 模板文件修改热更新**
    - **Property 8: HTML 模板文件新增热更新**
    - **Validates: Requirements 16.1, 16.2**

- [x] 11. Checkpoint — 确保新增场景测试通过
  - 确保连续快速修改、app.json 配置修改、文件重命名、HTML 模板文件测试全部通过，如有问题请向用户确认。

- [x] 12. 重构现有 HMR 测试并更新 CI 矩阵
  - [x] 12.1 重构 `e2e/ci/wevu-runtime.hmr.test.ts`
    - 将内联的 `waitForFileContains`、`resolvePlatforms`、`PLATFORM_TEMPLATE_EXT` 替换为从 `hmr-helpers.ts` 导入
    - 保持现有测试行为不变，仅改为复用共享工具函数
    - _Requirements: 9.1_

  - [x] 12.2 修改 `.github/workflows/ci-e2e.yml` 扩展 CI 矩阵
    - 在 `miniapp-e2e-ci` job 的 `matrix` 中添加 `os: [ubuntu-latest, windows-latest, macos-latest]`
    - 将 `runs-on` 改为 `${{ matrix.os }}`
    - 更新 job name 包含 OS 信息：`Miniapp E2E CI (${{ matrix.os }} / ${{ matrix.platform }})`
    - 处理 `ulimit` 命令在 Windows 上不可用的情况（条件执行）
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 13. Final checkpoint — 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP
- 所有测试文件使用 TypeScript + ESM，遵循仓库 2-space 缩进规范
- 每个任务引用具体需求编号以确保可追溯性
- Checkpoint 任务确保增量验证
- 测试复用现有 `startDevProcess`、`createDevProcessEnv`、`waitForFile` 工具函数
- 组件级新增/删除测试使用 `components/hmr-temp-comp/` 临时目录，测试结束后完全清理
- 文件重命名测试使用 `pages/hmr-rename-temp/` 临时目录，仅测试同目录内重命名
- HTML 模板测试页面 `pages/hmr-html/` 使用 .html 扩展名，dist 输出为对应平台模板扩展名
