# FlowTrans - AI 实时同声传译助手

FlowTrans 是一个面向实时语音理解与翻译的 AI 同声传译项目。

## 后端

后端使用 FastAPI，当前提供健康检查、运行配置查询、音频分片接收和实时 WebSocket 字幕接口。

### 安装依赖

```powershell
conda create -n flowtrans python=3.11
conda activate flowtrans
cd backend
python -m pip install -e ".[dev]"
```

### 运行测试

```powershell
cd backend
conda run -n flowtrans python -m pytest tests -v
```

### 启动服务

```powershell
conda activate flowtrans
cd backend
python -m uvicorn app.main:app --reload
```

## 前端

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`。

## 环境配置

本地演示默认使用 fake provider，不需要配置真实模型 API Key。

```powershell
$env:PROVIDER_MODE="fake"
```

如需准备接入真实 DashScope/Qwen 能力，请配置：

```powershell
$env:PROVIDER_MODE="dashscope"
$env:DASHSCOPE_API_KEY="<your-api-key>"
$env:DASHSCOPE_ASR_MODEL="qwen3-asr-flash-realtime"
$env:DASHSCOPE_TEXT_MODEL="qwen-plus"
$env:DASHSCOPE_TTS_MODEL="CosyVoice-v3.5-flash"
```
