# PodCast AI

面向「播客 → 可管理文档」的 Web 应用（SaaS）脚手架：**音频转录**（Whisper）、**结构化摘要**（Gemini / GPT-4o-mini）与**飞书云文档存档**，前后端分离，便于本地开发与后续部署。包括翻译和关键词高亮

详细需求、架构与里程碑见仓库中的设计书 **`PodCAst.docx`**。

## 项目目标

- **用户价值**：降低播客消费的时间成本，把长音频变成带时间戳文本与要点摘要，并一键归档到飞书，便于阅读、搜索与管理。
- **技术目标（设计书摘要）**：中文转录 WER &lt; 10%、单集摘要 3–5 个关键点、处理时效（如 &lt; 5 分钟 / 小时级音频）、文档创建链路可靠；模块化便于替换 ASR / LLM / 笔记渠道。
- **MVP 范围**：音频 URL 或本地上传 → 转录 → 摘要 →（规划）飞书文档；进度反馈与错误处理在后续迭代中完善。

## 仓库结构

| 目录 | 说明 |
|------|------|
| `backend/` | FastAPI 服务，`/api/v1` 下为与设计书一致的占位路由（下载 / 转录 / 摘要 / 飞书）。 |
| `frontend/` | React + Vite（TypeScript）前端。 |
| `.env.example` | API Key 与配置项模板；复制为 `.env` 后填写，**勿提交真实密钥**。 |

## 本地运行

### Windows：安装完整 Python（含标准库 `venv`）

若 `python -m venv` 提示 **No module named venv**，说明当前解释器多半是**不完整安装**。推荐改用 Python 官方构建。

**方式一：`winget`（自动化安装失败时请用管理员终端）**

在非管理员会话下，安装程序有时会以退出代码 **5（访问被拒绝）** 结束。请右键「终端」或 PowerShell → **以管理员身份运行**，再执行：

```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

**方式二：官网安装包（最稳妥）**

1. 打开 [Python Windows 下载页](https://www.python.org/downloads/windows/)，下载 **Windows installer (64-bit)**（例如 3.12.x）。
2. 运行安装程序：勾选 **Install launcher for all users**（可选）、**Add python.exe to PATH**，并确认默认组件中包含 **pip**、标准库（勿选嵌入式/embed 极简安装）。
3. **新建**一个终端窗口，验证：

```powershell
where.exe python
python -c "import venv, ensurepip; print('Python OK:', __import__('sys').executable)"
```

若 `where python` 仍指向旧的 `D:\...` 等非官方路径，可在「设置 → 应用」中卸载冲突的旧 Python，或在安装结束时使用 **Disable path length limit**，并把 **`%LocalAppData%\Programs\Python\Python312\`** 加到 PATH 较前位置。

### Windows：将 Python 3.14 设为默认

希望新开终端里输入 **`python`** 就是 3.14 时，需要把 **3.14 的安装目录和 `Scripts` 放在用户 PATH 最前面**（排在旧的 `D:\Python3.12` 等路径之前）。

在自己电脑上的 **PowerShell** 中执行（若 3.14 不在 `D:\Program Files\Python314`，请先改掉前两行的路径）：

```powershell
$py314 = 'D:\Program Files\Python314'
$py314Scripts = 'D:\Program Files\Python314\Scripts'
if (-not (Test-Path "$py314\python.exe")) { throw "未找到 $py314\python.exe，请按实际安装路径修改 `$py314" }
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$parts = @($userPath -split ';' | Where-Object { $_ })
$filtered = $parts | Where-Object { $_ -ne $py314 -and $_ -ne $py314Scripts }
$newPath = (($py314, $py314Scripts) + $filtered) -join ';'
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
```

然后 **关掉所有终端窗口再打开**，验证：

```powershell
where.exe python
python --version
```

第一行应出现 **`...\Python314\python.exe`**，`python --version` 应为 **3.14.x**。

若常用 **`py` 启动器**，可再设用户变量 **`PY_PYTHON`= `3.14`**（PowerShell：`[Environment]::SetEnvironmentVariable('PY_PYTHON', '3.14', 'User')`），新开终端后 `py` 会默认选 3.14。

### 后端（务必使用虚拟环境）

**不要把后端依赖装进全局 Python。** 在 `backend` 目录创建并使用 **`.venv`**，只用该环境里的 `pip` / `python`。

配置仍可使用仓库根目录的 `.env`（`app/config.py` 会读取 `backend/.env` 与上级目录的 `.env`）。

**PowerShell（推荐：不显式 `activate`，直接用 `.venv` 里的解释器，避免脚本执行策略问题）**

```powershell
cd E:\Web\podcast-ai\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**CMD（可选用 `activate.bat`）**

```cmd
cd /d E:\Web\podcast-ai\backend
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

若 `python -m venv` 报错（例如精简版 Python 未带 `venv`），可先安装 [python.org](https://www.python.org/downloads/) 完整版并勾选默认组件，或使用：`pip install virtualenv`，再执行 `virtualenv .venv`。

打开交互式 API 文档：<http://127.0.0.1:8000/docs>。

**前端**：

```bash
cd frontend
npm install
npm run dev
```

开发环境下 Vite 已将 `/api` 与 `/health` 代理到 `http://127.0.0.1:8000`。

## 环境变量

参见根目录 **`.env.example`**：OpenAI、Gemini、飞书应用凭证及 `BACKEND_CORS_ORIGINS` 等。后端通过 `pydantic-settings` 读取（当前使用 `BACKEND_CORS_ORIGINS`）；各 AI/飞书 Key 将在实现对应模块时使用。

## 许可与说明

本仓库为根据内部设计书初始化的工程骨架；业务逻辑与第三方集成需在后续迭代中补全。
