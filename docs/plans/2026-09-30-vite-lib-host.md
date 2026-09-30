# 三入口组件库编译对齐

## 共享发布

三个入口使用顶层 weapp.lib。库声明生成移入共享编译插件，原生组件、Vue SFC、纯脚本及 fileName 映射不再依赖 CLI 构建结束后的追加任务。声明中间文件只进入临时目录，最终产物进入 Vite/Rolldown bundle；build.write=false 不写最终输出，生产 watch 每轮重新发布声明。

声明打包绑定宿主 Rolldown；每轮 TypeScript 使用独立缓存。声明编译发现的类型输入交给宿主监听，避免类型更新后仍保留旧 d.ts。符号链接项目同时记录入口逻辑路径和真实路径，tsconfig 使用与打包器一致的真实路径，避免漏生成组件 JSON 或找不到类型入口。

## 开发与运行时

classic dev 复用组件库编译，开发阶段延续原有不生成声明的行为。新增 e2e-apps/lib-mode/runtime 消费预编译原生/Vue 组件，库产物由库构建生成，消费应用以 emptyOutDir=false 保留该目录；不通过手写最终文件补齐输出。

同一个 automator suite 覆盖挂载、两种组件点击更新和 reLaunch 后的状态重置；headless 与真实微信 IDE 使用同一断言。消费脚本打包完整 workspace 运行时依赖闭包并严格安装，分别执行 wv、vite、vp 原生命令。所有 runtime 验证串行。

## 验证记录

定向 6 文件 152 项通过，覆盖声明与伴随资源、内存构建、重命名、classic 更新、生产 watch 类型依赖与错误恢复、符号链接及 Windows 路径身份。包级类型、公开类型、构建、ESLint、网站与共享 automator 检查通过。

三入口严格 tarball 消费通过；wv、vite、vp 的原生 dev 均通过，vite/vp 原生 build watch 同时检查声明更新。每入口 headless 与真实微信 IDE 各 1 个场景通过，包含原生/Vue 组件挂载、两次交互与页面重入，运行时 error/exception 为 0。真实 IDE 使用组件 ID 定位，保持与 headless 同一断言。CI 以本阶段 PR checks 为准；本阶段不关闭 #1097。

## 文件边界

新增 libDts/assets.ts 负责中间产物和资源清理，plugins/libDts.ts 负责宿主发布。既有 build service、入口加载和声明测试文件超过 300 行；本次移出 CLI 的声明编排，仅在现有入口识别处修正路径身份，不继续向大文件加入新的宿主流程。
