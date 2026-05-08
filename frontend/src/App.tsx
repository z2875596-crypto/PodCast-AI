import './App.css'

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>PodCast AI</h1>
        <p className="tagline">
          播客音频转文字、结构化摘要与飞书云文档存档 — MVP 脚手架已就绪。
        </p>
      </header>

      <section className="panel" aria-label="后续功能占位">
        <p>
          前端：<strong>React + Vite</strong> · 后端：<strong>FastAPI</strong>{' '}
          <code>/api/v1</code>
        </p>
        <p className="hint">
          复制仓库根目录 <code>.env.example</code> 为 <code>.env</code> 并填入各服务商
          API Key；本地开发可将 Vite 代理到后端（见 <code>vite.config.ts</code>）。
        </p>
      </section>
    </main>
  )
}

export default App
