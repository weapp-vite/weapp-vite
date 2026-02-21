# PPT 内嵌视频成片流程（weapp-vite 演示）

目标：把录屏原片稳定转换成 PPT 友好的 MP4，保证播放流畅、清晰，并准备一个封面图用于第一页展示。

## 产出物

- `ppt-hq.mp4`：用于本地演讲，画质优先
- `ppt-lite.mp4`：用于线上传输或体积受限场景
- `poster.png`：封面图（可放在 PPT 首页）

## 前置要求

1. 已录制原始视频（建议 OBS 导出 `mp4`）
2. 本机已安装 `ffmpeg` 与 `ffprobe`
3. 建议原始录屏分辨率不低于 `1920x1080`

安装示例：

- macOS（Homebrew）：`brew install ffmpeg`
- Windows（scoop）：`scoop install ffmpeg`

## 一键导出（推荐）

```bash
pnpm -C apps/wevu-vue-sfc-recording-demo video:prepare -- ./recordings/raw-demo.mp4
```

执行后会在 `apps/wevu-vue-sfc-recording-demo/video-output/` 下得到：

- `ppt-hq.mp4`
- `ppt-lite.mp4`
- `poster.png`

如果你希望先裁掉片头/片尾，可传入时间参数：

```bash
pnpm -C apps/wevu-vue-sfc-recording-demo video:prepare -- ./recordings/raw-demo.mp4 00:00:02 00:01:45
```

参数含义：

- 第 1 个参数：输入视频路径
- 第 2 个参数：可选，起始时间（`HH:MM:SS`）
- 第 3 个参数：可选，结束时间（`HH:MM:SS`）

## 脚本行为说明

脚本 `docs/recording/wevu-vue-sfc-recording-demo/export-ppt-video.sh` 会做这些事：

1. 按需要裁剪时长（可选）
2. 统一转成 `1920x1080`、`30fps`、`yuv420p`（PPT 最兼容）
3. 生成高质量版本：`CRF 20`（体积更大，细节更好）
4. 生成轻量版本：`CRF 25`（更小，方便传输）
5. 从第 1 秒提取封面图：`poster.png`

## PowerPoint / Keynote 建议

### PowerPoint

1. 插入视频后勾选 `自动播放` 或按需点击播放。
2. 播放页勾选 `循环播放，直到停止`（用于展台循环）。
3. 若现场机器性能一般，优先用 `ppt-lite.mp4`。
4. 在播放选项里关闭“全屏自动拉伸”以避免裁切代码区域。

### Keynote

1. 媒体格式优先使用 `H.264 + AAC`（脚本已满足）。
2. 打开“文稿”设置后测试一次循环播放。
3. 导出到另一台设备前，先打开一遍确认字体与清晰度。

## 手动命令（不使用脚本）

高质量版：

```bash
ffmpeg -y -i raw-demo.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -ar 48000 \
  ppt-hq.mp4
```

轻量版：

```bash
ffmpeg -y -i raw-demo.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 25 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k -ar 48000 \
  ppt-lite.mp4
```

封面图：

```bash
ffmpeg -y -ss 00:00:01 -i raw-demo.mp4 -frames:v 1 poster.png
```

## 交付前自检清单

1. 视频能在本机 PowerPoint 全屏下流畅播放。
2. 代码文字在投影距离下仍可辨识（至少 24px 字号录制）。
3. 文件命名清晰：`project-topic-duration-date.mp4`。
4. 现场备用两个版本：`ppt-hq.mp4` 和 `ppt-lite.mp4`。
5. 复制到 U 盘后再次试播一次。
