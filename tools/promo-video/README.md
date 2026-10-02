# weapp-vite 品牌宣传片

基于 Remotion、React 和 TypeScript 的可重复渲染宣传片工程。采用每镜头 5 秒的快剪节奏：横版 12 个镜头，竖版 6 个镜头，分别编排构图，共享品牌素材。画面为功能演绎，配乐与转场音效由本工程原创合成，无旁白。

| Composition | 画幅 | 时长 | 帧率 |
| --- | --- | --- | --- |
| `PromoLandscape` | 1920 × 1080 | 60 秒 | 60 fps |
| `PromoPortrait` | 1080 × 1920 | 30 秒 | 60 fps |

## 使用

在仓库根目录安装依赖后运行。沿用仓库 Node.js 与 pnpm 要求；配乐合成和验收需要 PATH 中可用的 FFmpeg、FFprobe。首次渲染时 Remotion 会按需下载 Chrome Headless Shell，后续使用本地缓存。

```bash
pnpm install
pnpm --filter @weapp-vite/promo-video studio
```

推荐交付顺序：

```bash
pnpm --filter @weapp-vite/promo-video typecheck
pnpm --filter @weapp-vite/promo-video lint
node node_modules/vitest/vitest.mjs run --config tools/promo-video/scripts/validateTimeline.vitest.config.ts
pnpm --filter @weapp-vite/promo-video render:stills
pnpm --filter @weapp-vite/promo-video render
pnpm --filter @weapp-vite/promo-video verify
```

单独更新一个画幅：

```bash
pnpm --filter @weapp-vite/promo-video render:landscape
pnpm --filter @weapp-vite/promo-video render:portrait
```

渲染器默认最多使用 6 个并行页面，可通过环境变量 `PROMO_RENDER_CONCURRENCY` 设置正整数。需要指定已有 Chromium 时设置 `REMOTION_BROWSER_EXECUTABLE`。验收工具可通过 `FFMPEG_PATH`、`FFPROBE_PATH` 指定可执行文件。所有子进程直接传参，不依赖 shell 拼接。

## 本地输出

成片与预览保存在仓库根目录 `artifacts/promo-video/`，中间产物保存在 `.cache/promo-video/`，均不纳入 Git。

| 文件 | 内容 |
| --- | --- |
| `weapp-vite-landscape.mp4` | 横版成片 |
| `weapp-vite-portrait.mp4` | 竖版成片 |
| `cover-landscape.png`、`cover-portrait.png` | 最后一帧的完整分辨率封面 |
| `storyboard-landscape.png`、`storyboard-portrait.png` | 横版 12 镜头、竖版 6 镜头的中点分镜 |
| `cues-landscape.png`、`cues-portrait.png` | 每个动作 cue 之后 70 帧的画面联系表 |
| `transitions-landscape.png`、`transitions-portrait.png` | 首尾、首屏 0.5 秒与每个切点前一帧、切点帧、后一帧的联系表 |
| `frames/<画幅>/` | 完整分辨率 PNG 与包含帧号、时间的索引 |
| `verification.json` | 成片自动技术验收结果 |

MP4 使用 H.264、CRF 18、yuv420p、BT.709、AAC 320 kbps / 48 kHz 立体声，并启用 faststart。`render` 顺序渲染横版与竖版。`render:stills` 适合先检查画面布局；素材准备会校验配乐缓存，仅在源码变化或文件缺失时重新合成。

刷新关键帧时，仅清理当前画幅的 `frames/<画幅>/` 后重建，避免旧帧混入新版索引。本次改剪前的本地成片保存在 `previous-original/`，可与新版对比；渲染和验收命令不会删除该目录，也不会在全新 checkout 中生成旧版。

## 编辑与素材

`src/index.tsx` 注册 Composition；`src/` 中的场景、组件与样式负责画面。所有动画使用当前帧计算，重渲染结果不依赖墙上时钟。修改文案、动效或布局后重新生成关键帧，再检查完整视频。

`src/timeline.ts` 是画面、配乐、预览和验收共用的时间线。横版按品牌开场、原生能力、现代工具链、Vue SFC、响应式、样式更新、路由、组件、npm 与分包、AI 运行现场、截图与日志、品牌收束依次展开；竖版将关联能力合并为六个镜头。

时间线固定 60 fps、144 BPM：每拍 25 帧，每镜头 12 拍即 300 帧 / 5 秒。每镜头相对帧 0、100、200 是三个动作 cue，让主要变化落在音乐拍点上。预览选取每镜头中点与各 cue 后 70 帧，便于检查最长 45 帧的动作完成后的内容，并额外保留全片第 30 帧核对首屏 0.5 秒的主标题。调整镜头或 cue 时修改共享时间线；音频缓存指纹包含时间线源码和合成源码，使旧节奏不会被缓存复用。

- Logo 直接取自仓库 `website/public/logo.svg`，素材准备阶段复制到临时静态资源目录，避免维护另一份品牌源文件。
- `public/fonts/NotoSansSC.ttf` 是完整的 [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 可变字体，可直接修改中文文案；[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) 的 `public/fonts/JetBrainsMono.woff2` 用于代码。字体离线加载，OFL 许可随字体保存。
- `scripts/audio.ts` 与 `scripts/audio/` 生成两套独立编排的 144 BPM 配乐，包含节拍、和声、旋律与场景音效，没有外部歌曲或采样依赖。配乐说明见 [音频 README](scripts/audio/README.md)。
- 代码示例遵循 Wevu 的实际 API。画面中的运行效果明确标注为功能演绎，不作为性能测量或 runtime 验收证据。

本工程为私有宣传素材工具，没有业务 `build` / `dev` 脚本，不改变产品运行时或公开 API。

## 验收

Studio、渲染和成片验收开始前均先校验共享时间线：横版 12 镜头、竖版 6 镜头，每镜头 300 帧，总长 3600 / 1800 帧；镜头连续且无重叠，首尾为 intro / outro，动作 cue 位于镜头内并符合拍点，预览 cuts 与镜头边界一致。针对缺口、重叠、越界 cue、漂移切点与错误收尾的回归测试使用上面的独立 Vitest 配置运行。

`verify` 会检查两支成片的尺寸、60 fps、总帧数、时长、H.264 / yuv420p、AAC 48 kHz 立体声，以及 MP4 的 moov / mdat 顺序。FFmpeg 完整解码成片，并检测内部近纯黑帧、综合响度与真峰值。响度验收区间为 −14 ±1 LUFS，真峰值目标不高于 −1 dBTP，测量容差 0.05 dB。

黑帧检测采用接近纯黑的像素阈值并将最短持续时间设为 0，连单帧近纯黑闪烁也纳入检查；仅容许首尾各 0.25 秒内的黑场。自动检测不能识别所有色彩或曝光闪烁，不能替代逐场景和完整播放检查。交付前检查分镜、所有切点、中文字体、文字边界、竖版安全区，并完整播放确认阅读节奏、音画同步和音乐收束。技术报告不会宣称已完成人工观看或听审。

源码与原创合成音频沿用仓库许可；字体按各自 OFL 许可使用。Remotion 的使用遵循其自身许可条款，第三方依赖许可不由本项目替代。
