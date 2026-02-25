# 需求文档

## 简介

为 weapp-vite 的开发模式（dev watch）热更新（HMR）功能编写全面的端到端测试用例。测试需覆盖多种文件类型（模板、样式、脚本、JSON 配置、Vue SFC）的修改、新增、删除操作，并在 macOS、Windows、Linux 三大操作系统上通过 CI/CD 矩阵运行，确保 HMR 在各平台上的行为一致性和正确性。

## 术语表

- **HMR_Test_Suite**: weapp-vite 热更新端到端测试套件，位于 `e2e/ci/` 目录下
- **Dev_Process**: 通过 `weapp-vite dev` 启动的开发监听进程，监控源文件变更并输出到 dist 目录
- **Dist_Root**: 构建输出目录 `e2e-apps/wevu-runtime-e2e/dist`
- **Source_Root**: 源代码目录 `e2e-apps/wevu-runtime-e2e/src`
- **Platform**: 小程序目标平台，包括 weapp（微信）、alipay（支付宝）、tt（抖音）
- **CI_Matrix**: GitHub Actions 中的矩阵策略，用于在多个操作系统和平台组合上并行运行测试
- **Template_File**: 小程序模板文件（.wxml/.axml/.ttml），根据平台不同扩展名不同
- **Style_File**: 小程序样式文件（.wxss/.acss/.ttss），根据平台不同扩展名不同
- **Script_File**: TypeScript 脚本文件（.ts），编译后输出为 .js
- **JSON_Config**: 页面或组件的 JSON 配置文件（.json）
- **Vue_SFC**: Vue 单文件组件（.vue），包含 template、script、style 三个部分

## 需求

### 需求 1：模板文件修改热更新

**用户故事：** 作为开发者，我希望修改模板文件后 dist 目录能自动更新，以便我能快速看到模板变更的效果。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中的 .wxml 模板文件内容, THE Dev_Process SHALL 在 dist 目录中生成包含修改内容的对应平台模板文件
2. WHEN 开发者修改组件目录下的 .wxml 模板文件内容, THE Dev_Process SHALL 在 dist 目录中更新对应组件的平台模板文件

### 需求 2：样式文件修改热更新

**用户故事：** 作为开发者，我希望修改样式文件后 dist 目录能自动更新，以便我能快速看到样式变更的效果。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中的 .wxss 样式文件内容, THE Dev_Process SHALL 在 dist 目录中生成包含修改内容的对应平台样式文件
2. WHEN 开发者修改组件目录下的 .wxss 样式文件内容, THE Dev_Process SHALL 在 dist 目录中更新对应组件的平台样式文件

### 需求 3：脚本文件修改热更新

**用户故事：** 作为开发者，我希望修改 TypeScript 脚本文件后 dist 目录能自动更新，以便我能快速看到逻辑变更的效果。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中的 .ts 脚本文件内容, THE Dev_Process SHALL 在 dist 目录中生成包含编译后修改内容的 .js 文件
2. WHEN 开发者修改组件目录下的 .ts 脚本文件内容, THE Dev_Process SHALL 在 dist 目录中更新对应组件的 .js 文件

### 需求 4：JSON 配置文件修改热更新

**用户故事：** 作为开发者，我希望修改页面或组件的 JSON 配置文件后 dist 目录能自动更新，以便配置变更能即时生效。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中页面的 .json 配置文件内容, THE Dev_Process SHALL 在 dist 目录中生成包含修改内容的对应 .json 文件
2. WHEN 开发者修改组件目录下的 .json 配置文件内容, THE Dev_Process SHALL 在 dist 目录中更新对应组件的 .json 文件

### 需求 5：Vue SFC 文件修改热更新

**用户故事：** 作为开发者，我希望修改 Vue 单文件组件后 dist 目录能自动更新，以便我能快速看到 SFC 各部分变更的效果。

#### 验收标准

1. WHEN 开发者修改 Vue_SFC 的 template 部分, THE Dev_Process SHALL 在 dist 目录中更新对应的平台模板文件
2. WHEN 开发者修改 Vue_SFC 的 style 部分, THE Dev_Process SHALL 在 dist 目录中更新对应的平台样式文件
3. WHEN 开发者修改 Vue_SFC 的 script 部分, THE Dev_Process SHALL 在 dist 目录中更新对应的 .js 文件

### 需求 6：新增文件热更新

**用户故事：** 作为开发者，我希望在源目录中新增文件后 dist 目录能自动生成对应的输出文件，以便新增的页面或组件能即时可用。

#### 验收标准

1. WHEN 开发者在 Source_Root 中新增一个 .wxml 模板文件, THE Dev_Process SHALL 在 dist 目录中生成对应的平台模板文件
2. WHEN 开发者在 Source_Root 中新增一个 .wxss 样式文件, THE Dev_Process SHALL 在 dist 目录中生成对应的平台样式文件
3. WHEN 开发者在 Source_Root 中新增一个 .ts 脚本文件, THE Dev_Process SHALL 在 dist 目录中生成对应的编译后 .js 文件
4. WHEN 开发者在 Source_Root 中新增一个 .json 配置文件, THE Dev_Process SHALL 在 dist 目录中生成对应的 .json 文件
5. WHEN 开发者在 Source_Root 中新增一个 Vue_SFC 文件, THE Dev_Process SHALL 在 dist 目录中生成对应的模板、样式和脚本文件

### 需求 7：删除文件热更新

**用户故事：** 作为开发者，我希望在源目录中删除文件后 dist 目录能自动移除对应的输出文件，以便 dist 目录保持与源目录的一致性。

#### 验收标准

1. WHEN 开发者从 Source_Root 中删除一个 .wxml 模板文件, THE Dev_Process SHALL 从 dist 目录中移除对应的平台模板文件
2. WHEN 开发者从 Source_Root 中删除一个 .wxss 样式文件, THE Dev_Process SHALL 从 dist 目录中移除对应的平台样式文件
3. WHEN 开发者从 Source_Root 中删除一个 .ts 脚本文件, THE Dev_Process SHALL 从 dist 目录中移除对应的 .js 文件
4. WHEN 开发者从 Source_Root 中删除一个 .json 配置文件, THE Dev_Process SHALL 从 dist 目录中移除对应的 .json 文件
5. WHEN 开发者从 Source_Root 中删除一个 Vue_SFC 文件, THE Dev_Process SHALL 从 dist 目录中移除对应的模板、样式和脚本文件

### 需求 8：跨平台 CI 矩阵支持

**用户故事：** 作为项目维护者，我希望 HMR 测试能在 macOS、Windows、Linux 三大操作系统上运行，以便确保热更新功能在所有平台上行为一致。

#### 验收标准

1. THE CI_Matrix SHALL 在 ubuntu-latest、windows-latest、macos-latest 三个操作系统上运行 HMR_Test_Suite
2. THE CI_Matrix SHALL 对每个操作系统分别运行 weapp、alipay、tt 三个平台的 HMR 测试
3. WHEN 任一操作系统和平台组合的 HMR 测试失败, THE CI_Matrix SHALL 报告具体的失败操作系统和平台信息

### 需求 9：测试工具函数复用与扩展

**用户故事：** 作为测试开发者，我希望 HMR 测试能复用现有的工具函数并按需扩展，以便测试代码保持简洁和可维护。

#### 验收标准

1. THE HMR_Test_Suite SHALL 复用现有的 `startDevProcess`、`createDevProcessEnv`、`waitForFile` 工具函数
2. THE HMR_Test_Suite SHALL 提供 `waitForFileContains` 工具函数用于等待文件包含指定内容
3. THE HMR_Test_Suite SHALL 提供 `waitForFileRemoved` 工具函数用于等待文件被删除
4. THE HMR_Test_Suite SHALL 在每个测试用例结束后恢复所有被修改、新增或删除的源文件到原始状态

### 需求 10：测试源文件管理

**用户故事：** 作为测试开发者，我希望有专门的 HMR 测试页面和文件，以便测试操作不会影响其他 e2e 测试。

#### 验收标准

1. THE HMR_Test_Suite SHALL 使用 `pages/hmr/` 目录下的现有文件作为修改操作的测试目标
2. THE HMR_Test_Suite SHALL 使用独立的临时文件路径进行新增和删除操作的测试
3. WHEN 测试执行完毕, THE HMR_Test_Suite SHALL 确保 Source_Root 中的所有文件恢复到测试前的状态

### 需求 11：连续快速修改热更新

**用户故事：** 作为开发者，我希望连续快速修改同一文件后 dist 目录能正确反映最终修改内容，以便在快速迭代时不会出现中间状态残留。

#### 验收标准

1. WHEN 开发者对同一 .wxml 模板文件连续执行两次修改（间隔小于 1 秒）, THE Dev_Process SHALL 最终在 dist 目录中生成包含第二次修改内容的对应平台模板文件
2. WHEN 开发者对同一 .ts 脚本文件连续执行两次修改（间隔小于 1 秒）, THE Dev_Process SHALL 最终在 dist 目录中生成包含第二次编译后修改内容的 .js 文件
3. WHEN 开发者对同一 Vue_SFC 文件连续执行两次修改（间隔小于 1 秒）, THE Dev_Process SHALL 最终在 dist 目录中生成包含第二次修改内容的对应输出文件

### 需求 12：app.json 配置修改热更新

**用户故事：** 作为开发者，我希望修改 app.json 全局配置后 dist 目录能自动更新，以便全局配置变更能即时生效。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中 app.json 的 window 配置项, THE Dev_Process SHALL 在 dist 目录中生成包含修改内容的 app.json 文件
2. WHEN 开发者修改 Source_Root 中 app.json 的 pages 数组（新增页面路径）, THE Dev_Process SHALL 在 dist 目录中更新 app.json 并生成新增页面的输出文件

### 需求 13：组件级文件新增热更新

**用户故事：** 作为开发者，我希望在组件目录中新增文件后 dist 目录能自动生成对应的输出文件，以便新增的组件文件能即时可用。

#### 验收标准

1. WHEN 开发者在 components 目录中新增一个完整的组件（包含 .wxml、.ts、.wxss、.json 文件）, THE Dev_Process SHALL 在 dist 目录中生成对应的所有组件输出文件
2. WHEN 开发者在现有组件目录中新增一个 .wxss 样式文件, THE Dev_Process SHALL 在 dist 目录中生成对应的平台样式文件

### 需求 14：组件级文件删除热更新

**用户故事：** 作为开发者，我希望在组件目录中删除文件后 dist 目录能自动移除对应的输出文件，以便 dist 目录保持与源目录的一致性。

#### 验收标准

1. WHEN 开发者从 components 目录中删除一个组件的 .wxml 模板文件, THE Dev_Process SHALL 从 dist 目录中移除对应的平台模板文件
2. WHEN 开发者从 components 目录中删除一个组件的 .wxss 样式文件, THE Dev_Process SHALL 从 dist 目录中移除对应的平台样式文件

### 需求 15：文件重命名热更新

**用户故事：** 作为开发者，我希望重命名源文件后 dist 目录能正确处理（移除旧文件、生成新文件），以便文件重命名操作不会导致 dist 目录不一致。

#### 验收标准

1. WHEN 开发者将 Source_Root 中的一个 .wxml 模板文件重命名, THE Dev_Process SHALL 从 dist 目录中移除旧文件名对应的平台模板文件，并生成新文件名对应的平台模板文件
2. WHEN 开发者将 Source_Root 中的一个 .ts 脚本文件重命名, THE Dev_Process SHALL 从 dist 目录中移除旧文件名对应的 .js 文件，并生成新文件名对应的 .js 文件

### 需求 16：HTML 模板文件热更新

**用户故事：** 作为开发者，我希望使用 .html 作为模板文件扩展名时 HMR 也能正常工作，以便支持 weapp-vite 的多模板格式特性。

#### 验收标准

1. WHEN 开发者修改 Source_Root 中的 .html 模板文件内容, THE Dev_Process SHALL 在 dist 目录中生成包含修改内容的对应平台模板文件
2. WHEN 开发者在 Source_Root 中新增一个 .html 模板文件, THE Dev_Process SHALL 在 dist 目录中生成对应的平台模板文件
