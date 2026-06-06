# FlowTrans - AI 实时同声传译助手

FlowTrans 是一个面向实时语音理解与翻译的 AI 同声传译项目。当前 MVP 支持浏览器端麦克风/系统音频采集、后端 WebSocket 字幕流、fake provider 本地演示、字幕回改高亮和中文语音开关 UI。

## 本地演示

MVP 默认使用 DashScope/Qwen 真实链路；如需离线演示，可手动切换到 fake provider。

### 终端 1：启动后端

```powershell
cd backend
conda run -n flowtrans python -m pip install -e ".[dev]"
conda run -n flowtrans python -m uvicorn app.main:app --reload
```

### 终端 2：启动前端

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，选择“麦克风”或“系统音频”，然后点击“开始”。

## 后端

后端使用 FastAPI，当前提供：

- `/health` 健康检查接口
- `/config` 公开配置接口
- `/ws/realtime` 实时 WebSocket 字幕接口
- fake provider 字幕演示链路
- DashScope/Qwen 文本翻译与上下文纠错链路
- DashScope `qwen3-asr-flash-realtime` 实时 ASR 链路

当前 `PROVIDER_MODE="dashscope"` 时，后端会将浏览器音频 chunk 转发给 `qwen3-asr-flash-realtime`，再把英文转写交给 `qwen-plus` 翻译。前端仍使用浏览器默认录音格式；如果真实识别效果不稳定，后续 PR 会单独接入 PCM 采集。

TTS（`CosyVoice-v3.5-flash`）仍保留为后续独立 PR 接入。

### 后端测试

```powershell
cd backend
conda run -n flowtrans python -m pytest tests -v
```

## 前端

前端使用 React、Vite 和 TypeScript。

### 前端测试与构建

```powershell
cd frontend
npm run test
npm run build
```

## 环境配置

默认真实链路使用 DashScope/Qwen：

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="qwen3-asr-flash-realtime"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="CosyVoice-v3.5-flash"
```

如需离线演示，可切换到 fake provider：

```powershell
$env:PROVIDER_MODE="fake"
```

不要把 `DASHSCOPE_API_KEY` 写入代码或提交到仓库。
