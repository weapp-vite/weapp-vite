# 维护入口与冻结恢复

日常验收不联网：在仓库根目录运行 pnpm corpus:check，以及重建 @weapp-vite/wxml 后的 test:corpus、test:fuzz、test:coverage。完整操作契约见 scripts/templateCorpus/README.md。

sources.json 是从冻结 CAS 配置恢复的原生选区配方，仅含存在 selections 的来源；expected、受控构建输入和自产矩阵不混入原生数量。新增或更新来源必须先审核许可、独立上游身份、固定提交及完整树，再显式执行采集。

maintenance/recovery-index.json.gz 保存每个来源 references.json 与配置对象身份。每个 references.json 可恢复完整 NativeEvidenceSource：tree 和 configuration 直接读取其 CAS；containers 从 object 原文恢复 path/text/sha256；snapshots 另保留 format 和 files 白名单。不可省略多份输入投影或多种抽取声明。

以下示例在仓库根目录恢复完整 source-evidence.json；它不执行上游源码、不访问网络，也不改写冻结语料：

```sh
node --input-type=module <<'JS'
import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const root = 'packages/wxml/test/corpus'
const read = async identity => {
  const bytes = gunzipSync(await readFile(`${root}/evidence/${identity.file}.gz`))
  if (bytes.length !== identity.bytes || createHash('sha256').update(bytes).digest('hex') !== identity.sha256) throw new Error('CAS identity mismatch')
  return bytes
}
const index = JSON.parse(gunzipSync(await readFile(`${root}/maintenance/recovery-index.json.gz`)))
const sources = []
for (const source of index.sources) {
  const reference = JSON.parse(await read(source.reference))
  const restore = async entry => ({ path: entry.path, text: (await read(entry.object)).toString('utf8'), sha256: entry.object.sha256 })
  const containers = await Promise.all(reference.containers.map(restore))
  const snapshots = await Promise.all(reference.snapshots.map(async entry => ({ ...await restore(entry), format: entry.format, files: entry.files })))
  sources.push({ repository: source.repository, commit: source.commit, tree: JSON.parse(await read(reference.tree)), configuration: JSON.parse(await read(reference.configuration)), containers, snapshots })
}
await writeFile('source-evidence.json', JSON.stringify(sources))
JS
```

框架输入 recipe 可从 configuration.inputMetadata[*].configuration 或显式 source/prefix/include/exclude 恢复；legacy inputProjections 是逐文件审核投影，须保留原映射，不猜测前缀。pnpm corpus:generate --freeze-input 接受恢复的固定配方；实际生成器依赖、锁文件、命令和原产物在 generation references 的 report/files 中。

静态 expected 配方在 configuration.expectedRecipes 中；先按固定提交恢复原快照、上游 serializer 与测试配置，再使用 corpus:generate --extract-expected。jest-files 必须保留确切的文件白名单，不能把 JS、样式或整个 bundle 当模板。

maintenance/audits.json.gz 映射审核报告至 CAS：Harmony JSUI 真实失败、MPX 历史附件缺失、分类证据和发现排除均保留。恢复缺失历史日志不得用当前日志替代原哈希。若原附件仍不可得，最终报告继续标记证据不完整。

非标准版权声明通过 additional 中 attribution/notices.json 单独冻结；licenses/inventory.json.gz 的 attributionSupplement 绑定其 CAS、原 Git blob、既有 licenseId、目录范围及 template/input/identity-evidence 实际关系。恢复时按 recovery-index 的 attributionSupplement 读取索引，再逐项读取 entry.object 原字节；使用 freezeAttributionNotices 保持原 grant 身份，不能把归属补充改当新授权或用来修补许可不足。

采集通过 corpus:collect --sources <审核配方>；离线导入通过 --collection <冻结报告> --source-evidence <恢复文件>；框架目录通过 --generation，静态输出通过 --expected，独立审核资料通过 --evidence 显式导入。完整规范以工具 README 为准。生成成功只有原生/预期/真实编译分类与冻结身份全部验证后才计数。
