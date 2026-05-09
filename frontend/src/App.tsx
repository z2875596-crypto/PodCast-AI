import { useState, useRef } from 'react'
import './App.css'

interface Summary {
  core_topic: string
  key_points: string[]
  conclusion: string
  target_audience: string
}

type Stage = 'idle' | 'downloading' | 'transcribing' | 'summarizing' | 'archiving' | 'done'

const API = '/api/v1'

export default function App() {
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url')
  const [url, setUrl]             = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [audioPath, setAudioPath] = useState('')
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [docUrl, setDocUrl]       = useState('')
  const [docTitle, setDocTitle]   = useState('')
  const [stage, setStage]         = useState<Stage>('idle')
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loading = ['downloading','transcribing','summarizing','archiving'].includes(stage)

  const stageLabel: Record<Stage, string> = {
    idle: '', downloading: '正在下载音频…',
    transcribing: '正在转录，请稍候…',
    summarizing: '正在生成摘要…',
    archiving: '正在创建飞书文档…',
    done: '',
  }

  async function run() {
    setError('')
    try {
      setStage('downloading')
      let res: Response
      if (inputMode === 'url') {
        res = await fetch(`${API}/audio/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
      } else {
        if (!file) throw new Error('请选择音频文件')
        const form = new FormData()
        form.append('file', file)
        res = await fetch(`${API}/audio/upload`, { method: 'POST', body: form })
      }
      let data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '音频处理失败')
      const path = data.path
      setAudioPath(path)

      setStage('transcribing')
      res = await fetch(`${API}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '转录失败')
      setTranscript(data.text)

      setStage('summarizing')
      res = await fetch(`${API}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.text }),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '摘要失败')
      setSummary(data)
      setStage('idle')

    } catch (e: any) {
      setError(e.message)
      setStage('idle')
    }
  }

  async function handleArchive() {
    setError('')
    setStage('archiving')
    try {
      const res = await fetch(`${API}/feishu/create-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: docTitle || '播客摘要', transcript, summary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '创建文档失败')
      setDocUrl(data.doc_url)
      setStage('done')
    } catch (e: any) {
      setError(e.message)
      setStage('idle')
    }
  }

  function reset() {
    setUrl(''); setFile(null); setAudioPath(''); setTranscript('')
    setSummary(null); setDocUrl(''); setDocTitle(''); setError('')
    setStage('idle')
  }

  const hasResult = !!(transcript || summary)

  return (
    <div className="app">
      <div className="top-wave" />

      <header className="header">
        <div className="logo">
          <span className="logo-bubble">🎙</span>
          <div>
            <h1 className="logo-title">PodCast AI</h1>
            <p className="logo-sub">播客 → 文字 → 摘要 → 飞书</p>
          </div>
        </div>
      </header>

      <div className={`layout ${hasResult ? 'two-col' : 'one-col'}`}>

        <aside className="left-col">
          <div className="card input-card">
            <h2 className="card-title">
              <span className="step-badge">1</span>上传音频
            </h2>

            <div className="tab-row">
              <button className={`tab ${inputMode==='url'?'active':''}`} onClick={()=>setInputMode('url')}>
                🔗 URL 链接
              </button>
              <button className={`tab ${inputMode==='file'?'active':''}`} onClick={()=>setInputMode('file')}>
                📁 本地文件
              </button>
            </div>

            {inputMode === 'url' ? (
              <div className="field">
                <label>播客 / 音频链接</label>
                <input type="url" placeholder="https://…"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && !loading && run()}
                />
              </div>
            ) : (
              <div className="field">
                <label>选择音频文件</label>
                <div className="file-zone" onClick={()=>fileRef.current?.click()}>
                  {file
                    ? <><span className="file-icon">🎵</span><span className="file-name">{file.name}</span></>
                    : <><span className="upload-icon">↑</span><span>点击选择 MP3 / M4A / WAV</span></>
                  }
                  <input ref={fileRef} type="file"
                    accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                    style={{display:'none'}}
                    onChange={e=>setFile(e.target.files?.[0]||null)}
                  />
                </div>
              </div>
            )}

            {error && <div className="error-msg">⚠ {error}</div>}

            {loading ? (
              <div className="loading-box">
                <div className="dots"><span/><span/><span/></div>
                <p>{stageLabel[stage]}</p>
              </div>
            ) : (
              <button className="btn-run" onClick={run}
                disabled={inputMode==='url' ? !url : !file}>
                {hasResult ? '重新处理' : '开始处理 →'}
              </button>
            )}

            <div className="progress-steps">
              {[
                {key:'downloading', label:'下载音频', done: !!audioPath},
                {key:'transcribing', label:'转录', done: !!transcript},
                {key:'summarizing', label:'生成摘要', done: !!summary},
              ].map(s => (
                <div key={s.key} className={`progress-step ${stage===s.key?'active':''} ${s.done?'done':''}`}>
                  <span className="progress-dot"/>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {hasResult && (
          <div className="right-col">
            {summary && (
              <div className="card result-card">
                <h2 className="card-title">
                  <span className="step-badge">2</span>摘要
                </h2>
                <div className="topic-pill">{summary.core_topic}</div>
                <ul className="points-list">
                  {summary.key_points.map((p,i) => <li key={i}>{p}</li>)}
                </ul>
                <div className="meta-row">
                  <div className="meta-item">
                    <span className="meta-label">💡 结论</span>
                    <span>{summary.conclusion}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">👥 适合人群</span>
                    <span>{summary.target_audience}</span>
                  </div>
                </div>
              </div>
            )}

            {transcript && (
              <div className="card transcript-card">
                <h2 className="card-title">
                  <span className="step-badge">3</span>转录文本
                </h2>
                <div className="transcript-box">{transcript}</div>
              </div>
            )}

            {summary && (
              <div className="card archive-card">
                <h2 className="card-title">
                  <span className="step-badge">4</span>存档到飞书
                </h2>
                {stage === 'done' ? (
                  <div className="done-box">
                    <span className="done-check">✓</span>
                    <div className="done-info">
                      <p className="done-text">文档已创建成功！</p>
                      <a href={docUrl} target="_blank" rel="noreferrer" className="doc-link">
                        打开飞书文档 ↗
                      </a>
                    </div>
                    <button className="btn-ghost" onClick={reset}>处理新播客</button>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>文档标题（可选）</label>
                      <input type="text" placeholder="播客摘要"
                        value={docTitle} onChange={e=>setDocTitle(e.target.value)} />
                    </div>
                    <button className="btn-archive" onClick={handleArchive} disabled={loading}>
                      {stage==='archiving' ? '创建中…' : '创建飞书文档 →'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="footer">PodCast AI · Powered by Gemini & 飞书开放平台</footer>
    </div>
  )
}
