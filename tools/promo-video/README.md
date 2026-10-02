# weapp-vite 品牌宣传片

基于 Remotion、React 和 TypeScript 的可重复渲染宣传片工程。横版和竖版各自编排时间线与构图，共享品牌素材。画面为功能演绎，配乐与转场音效由本工程原创合成，无旁白。

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
| `storyboard-landscape.png`、`storyboard-portrait.png` | 六场景分镜预览 |
| `transitions-landscape.png`、`transitions-portrait.png` | 首尾、场景中点、切点前后帧的联系表 |
| `frames/<画幅>/` | 完整分辨率 PNG 与包含帧号、时间的索引 |
| `verification.json` | 成片自动技术验收结果 |

MP4 使用 H.264、CRF 18、yuv420p、BT.709、AAC 320 kbps / 48 kHz 立体声，并启用 faststart。`render` 顺序渲染横版与竖版。`render:stills` 适合先检查画面布局；素材准备会校验配乐缓存，仅在源码变化或文件缺失时重新合成。

## 编辑与素材

`src/index.tsx` 注册 Composition；`src/` 中的场景、组件与样式负责画面。所有动画使用当前帧计算，重渲染结果不依赖墙上时钟。修改文案、动效或布局后重新生成关键帧，再检查完整视频。

场景顺序是品牌开场、原生渐进升级、Vue SFC、工程自动化、AI 运行时协作、品牌收束。横版切点为 0 / 4 / 14 / 30 / 40 / 52 / 60 秒；竖版为 0 / 3 / 8 / 18 / 22 / 26 / 30 秒。画面与预览、验收共用 `src/timeline.ts` 的时间线；调整切点时也应同步音频编排。

- Logo 直接取自仓库 `website/public/logo.svg`，素材准备阶段复制到临时静态资源目录，避免维护另一份品牌源文件。
- `public/fonts/NotoSansSC.ttf` 是完整的 [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 可变字体，可直接修改中文文案；[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) 的 `public/fonts/JetBrainsMono.woff2` 用于代码。字体离线加载，OFL 许可随字体保存。
- `scripts/audio.ts` 与 `scripts/audio/` 生成两套独立编排的 128 BPM 配乐，包含节拍、和声、旋律与场景音效，没有外部歌曲或采样依赖。配乐说明见 [音频 README](scripts/audio/README.md)。
- 代码示例遵循 Wevu 的实际 API。画面中的运行效果明确标注为功能演绎，不作为性能测量或 runtime 验收证据。

本工程为私有宣传素材工具，没有业务 `build` / `dev` 脚本，不改变产品运行时或公开 API。

## 验收

`verify` 会检查两支成片的尺寸、60 fps、总帧数、时长、H.264 / yuv420p、AAC 48 kHz 立体声，以及 MP4 的 moov / mdat 顺序。FFmpeg 完整解码成片，并检测内部近纯黑帧、综合响度与真峰值。响度验收区间为 −14 ±1 LUFS，真峰值目标不高于 −1 dBTP，测量容差 0.05 dB。

黑帧检测采用接近纯黑的像素阈值，避免将深色品牌背景误报；仅容许首尾各 0.25 秒内的黑场。自动检测不能替代逐场景和完整播放检查。交付前检查分镜、所有切点、中文字体、文字边界、竖版安全区，并完整播放确认阅读节奏、音画同步和音乐收束。技术报告不会宣称已完成人工观看或听审。

源码与原创合成音频沿用仓库许可；字体按各自 OFL 许可使用。Remotion 的使用遵循其自身许可条款，第三方依赖许可不由本项目替代。
