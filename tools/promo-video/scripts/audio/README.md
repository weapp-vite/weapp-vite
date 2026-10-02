# 原创配乐与音效

144 BPM、D 小调的原创合成电子配乐。长版为 36 小节 / 60 秒，短版为 18 小节 / 30 秒；鼓组从开场第一拍进入，每个 5 秒镜头为 12 拍，第 1 / 5 / 9 拍用短冲击、扫频和拨弦配合画面主动作，末尾 2 秒收束。

音源由代码生成，没有使用第三方采样、录音或音乐素材。代码与生成音频均随项目采用 MIT 许可。固定种子的噪声、拍点与逐采样振荡器保证相同代码的离线合成可复现。

- `synth.ts`：温暖的和弦铺底、柔和拨弦、低音、鼓组与带限扫频。
- `score.ts`：Dm9 / Bbmaj9 / Fmaj9 / Cadd9 和声，读取共享时间线的镜头、能量、动作拍点与时长，编排独立短长版结构与品牌主题动机。
- `mix.ts`：等拍延迟、交叉早反射、低频清理、柔性饱和及片尾淡出。
- `normalize.ts`：FFmpeg 两遍 EBU R128 归一化，目标 −14 LUFS、真峰值上限 −2 dBTP，为重采样及成片 AAC 编码预留余量；最终成片验收阈值为 ≤ −1 dBTP。

从仓库根目录执行：

```sh
pnpm exec tsx tools/promo-video/scripts/audio.ts
pnpm exec tsx tools/promo-video/scripts/audio.ts artifacts/promo-video/audio
```

需要系统 `ffmpeg`。默认在 `.cache/promo-video/public/audio` 生成 `landscape.wav` 与 `portrait.wav`，均为 48 kHz、24 位 PCM、双声道。支持代码调用 `await generateAudio(outputDir)`。节奏与分镜的唯一来源是 `src/timeline.ts`，音频自动读取其中的 `bpm`、`framesPerBeat`、`filmSpecs` 和每镜 `cues` / `energy`。

输出目录的 `manifest.json` 保存音频源码、完整派生 `filmSpecs`、拍速与格式参数的 SHA-256 指纹，不包含机器路径。两个 WAV 存在且指纹一致时会直接复用缓存；修改音频源码、时间线编排或删除输出文件后，下次调用自动重建。
