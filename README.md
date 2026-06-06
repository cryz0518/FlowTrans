# FlowTrans - AI 实时同声传译助手

FlowTrans 是一个面向实时语音理解与翻译的 AI 同声传译项目。

## 后端

后端使用 FastAPI，当前提供健康检查与运行配置查询接口。

### 安装依赖

```powershell
conda create -n your_name python=3.11
conda activate your_name
cd backend
python -m pip install -e ".[dev]"
```

### 运行测试

```powershell
conda activate your_name
cd backend
python -m pytest tests/test_health.py -v
```

### 启动服务

```powershell
conda activate your_name
cd backend
python -m uvicorn app.main:app --reload
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
