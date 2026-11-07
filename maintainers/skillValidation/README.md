# 消费 Skill 维护用例

`cases.json` 固定四个自然请求、项目输入和每例四条判据；`feedback.json` 只保留匿名摘要与公开/仓库相对来源。这里不随三个消费包发布。所有初始用例和反馈均为 **candidate**，没有预填执行成功或人工批准。

## 重放

1. 保留旧/新完整 Skill 树，冻结同一请求、输入、模型/角色、SDK/宿主和工具权限。用现有 `packConsumerTarballs` 与消费包安装/来源工具准备一次真实公开包安装，再从该安装提供模块；不要把仓库源码或祖先 CLI 当成消费依赖。
2. 使用 `scripts/skillValidation/fixtures.mjs` 的现有函数：
   - `hashSkillTree(directory)`：计算所选完整 Skill 树摘要。
   - `createSkillCaseFixture({ caseId, outputParent, skillRoot, installedModulesRoot, catalog? })`：返回 `{ root, caseId, skill, skillDigest, packages, fixtureMode, cleanup }`。
   - `skillRoot` 指向所选技能目录，`installedModulesRoot` 指向上述真实安装的 `node_modules`，`outputParent` 是本轮隔离目录。先由契约校验器检查 catalog。
3. Fixture API 链接已安装的声明 owner 及其必需 peer 闭包，复制所选 Skill，并提供带实际版本的 `package.json` 和独立 workspace；不自动安装缺少的 peer，也不暴露无关 owner。只有 `edit-build` 有 build script。`files` 补齐其余输入，不能覆盖包清单、workspace、`.git`、`node_modules` 或 `.agents`，也不能包含大小写或 Unicode 规范化后相同的文件/目录路径。这是已安装包之上的隔离行为替身，不是重新安装发布包或证明正常安装流程。
4. 每组在 fresh context 只给执行者 `task` 和项目，不给判据或旧/新身份。core/SFC 允许修改并在 fixture 根执行已有 `pnpm run build`，不需要 IDE/登录；Wevu/React 只读诊断，无脚本不调用构建器。缺少宿主只阻塞依赖宿主的证明，不阻塞可达的静态诊断。
5. 独立收集真实工具轨迹、前后文件/依赖快照及语义产物。自动检查负责路由/JSON/模板等产物和副作用边界，不把特定修改文件或路由实现当作通过条件；用未修改项目的阳性对照区分构建器正常生成的类型支持文件与 Agent 手工改动。匿名盲审负责解释/API/证据边界，AI 不能代替必需自动检查。旧/新使用相同判据，分歧回到具体轨迹。报告及原始证据保存到本轮授权工件目录，消费包不收录。
6. 保存证据后调用 fixture 的 `cleanup` 回收本轮目录。不要清理用户安装或未知目录。

## 记录方法与结果

单例报告格式是 `{ version: 1, caseId, skillDigest, packages, records }`；`packages` 是真实包名到具体版本的映射，摘要须与当前完整 Skill 树匹配。每个 criterion 恰好一条记录：

| method | 必需依据 | result |
| --- | --- | --- |
| `automatic` | `evidence` 加真实 `command: { argv, exitCode }` 或 `observation: { tool, checks: [{ actual, expected }] }` | `passed` / `failed` |
| `ai` | `evidence`、`evaluator`，仅用于语义判据，不是自我批准 | `passed` / `failed` |
| `human` | `evidence` 及具体结果的 `confirmation` | `passed` / `failed` |
| `unverified` | `reason`，未执行，不附执行命令/观察/评价者/确认 | `not-run` |

每条记录包含 `criterionId, method, result, evidence`；不能把方法和结果混为一列。执行过的失败保留 `failed`，不改成 `not-run`；自动成功不能带非零退出码或不相等的观察值。报告不因命令退出成功就证明产物正确，也不因结构合法就成为全绿。

人工结果确认必须是 `{ scope: 'result', reference, subject }`，其中 `subject` **精确等于** `caseId:criterionId:skillDigest`，`reference` 指向人实际审阅该结果的记录。计划同意、发布方案同意、AI 评语均不算该确认。例子晋升需要 `scope: 'example'` 且 subject 为该 case ID；反馈审阅用 `scope: 'feedback'` 且 subject 为反馈 ID，均由对应的人明确审阅后才记录 `approved`。

## 静态边界与反馈

- `scripts/skillValidation/contracts.mjs` 仅导出纯函数：`safeProjectFilePath(value): boolean`；`validateCaseCatalog(catalog, distributionPackages)`；`validateFeedbackCatalog(feedback, caseCatalog)`；`validateEvidenceReport(report, caseCatalog, currentSkillDigests)`。后三者返回 `{ code, path }[]`。`distributionPackages` 使用 `skills/distribution.json` 的 `packages`；`currentSkillDigests` 按 skill 名索引。函数无 IO、网络、模型执行、源码重写或自动晋升。
- `node skills/scripts/check-public-skill-sync.mjs` 默认检查维护契约；加 `--evidence` 和单例报告文件检查记录一致性并分别汇总方法/结果。它不认证证据真伪、人的身份或授权，也不执行任务。`scripts/skillValidation/contracts.test.ts` 保护路径、陈旧证据、假通过和非法晋升等边界。
- `skills/scripts/score-skill-trigger-regression.mjs` 只聚合已填写的回归表，不运行 Agent，也不是这些用例的执行器；其分数不能当作行为证据。
- 反馈优先修工具、检查或经明确审阅的例子；一次风格偏好留在 `run` / `note`。长期规则要求 repository 范围、至少两个不同 recurrence 引用，以及人对该反馈 ID 的具体 `scope: 'rule'` 确认；模型不能自行批准或自动增长规则。`candidate/approved` 描述具体例子/反馈/规则，不描述发布方案是否获准。
- 反馈可附 `caseIds: string[]`；`nextAction: 'example'` 必须绑定至少一个已有且不重复的 case ID，其他 action 若附带也同样检查。`sourceRefs` 只是定位背景资料，不是真实性或人工批准证明；工具/检查改进可指向现有仓库回归测试。
- 只提交必要匿名摘要与可公开引用，不提交聊天原文、个人身份、机器绝对路径、凭据或私人日志；发布证据前另行脱敏。引用存在性、证据真实性和实际执行仍须独立核查。
