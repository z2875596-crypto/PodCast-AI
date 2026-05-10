import { useState, useRef } from 'react'
import './App.css'

interface Summary {
  core_topic: string
  key_points: string[]
  conclusion: string
  target_audience: string
}

type Stage = 'idle' | 'downloading' | 'transcribing' | 'summarizing' | 'archiving' | 'done'
type Page = 'cover' | 'main'

const API = '/api/v1'

export default function App() {
  const [page, setPage] = useState<Page>('cover')
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [editedSummary, setEditedSummary] = useState<Summary | null>(null)
  const [docUrl, setDocUrl] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loading = ['downloading','transcribing','summarizing','archiving'].includes(stage)

  const stageLabel: Record<Stage, string> = {
    idle: '', downloading: '正在下载音频…',
    transcribing: '正在转录，请稍候…',
    summarizing: '正在生成摘要…',
    archiving: '正在创建飞书文档…',
    done: '',
  }

  // 点击封面任意位置跳转
  function handleCoverClick() {
    setPage('main')
  }

  async function run() {
    setError('')
    setTranscript('')
    setSummary(null)
    setEditedSummary(null)
    setDocUrl('')
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
      setEditedSummary(data)
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
        body: JSON.stringify({
          title: docTitle || editedSummary?.core_topic || '播客摘要',
          transcript,
          summary: editedSummary,
        }),
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

  function updateKeyPoint(i: number, val: string) {
    if (!editedSummary) return
    const kp = [...editedSummary.key_points]
    kp[i] = val
    setEditedSummary({ ...editedSummary, key_points: kp })
  }

  // ── 封面页 ──────────────────────────────────────────────────
  if (page === 'cover') {
    return (
      <div className="cover" onClick={handleCoverClick}>
        <div className="cover-bg" />
        <div className="cover-content">
          <div className="cover-logo">
            <span className="cover-icon">◎</span>
            <h1 className="cover-title">PodCast<em>AI</em></h1>
          </div>
          <p className="cover-sub">播客音频 · 智能转录 · 一键存档</p>
          <div className="cover-hint">点击任意位置开始 →</div>
        </div>
        <div className="cover-circles">
          <div className="circle c1" />
          <div className="circle c2" />
          <div className="circle c3" />
        </div>
      </div>
    )
  }

  // ── 主页面 ──────────────────────────────────────────────────
  const hasResult = !!(transcript || summary)

  return (
    <div className="main-app">
      {/* 顶部导航 */}
      <nav className="topbar">
        <div className="topbar-logo" onClick={() => setPage('cover')}>
          <span className="topbar-icon">◎</span>
          <span>PodCast<em>AI</em></span>
        </div>
        {hasResult && (
          <button className="btn-new" onClick={() => {
            setTranscript(''); setSummary(null); setEditedSummary(null)
            setDocUrl(''); setUrl(''); setFile(null); setError(''); setStage('idle')
          }}>+ 新建</button>
        )}
      </nav>

      <div className="workspace">
        {/* ── 左栏：输入 ── */}
        <aside className="left-panel">
          <div className="panel-section">
            <h2 className="section-title">音频来源</h2>
            <div className="tab-row">
              <button className={`tab ${inputMode==='url'?'active':''}`} onClick={()=>setInputMode('url')}>🔗 URL</button>
              <button className={`tab ${inputMode==='file'?'active':''}`} onClick={()=>setInputMode('file')}>📁 上传文件</button>
            </div>

            {inputMode === 'url' ? (
              <div className="field">
                <input type="url" placeholder="粘贴播客链接…"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && !loading && run()}
                  className="url-input"
                />
              </div>
            ) : (
              <div className="file-zone" onClick={() => fileRef.current?.click()}>
                {file
                  ? <><div className="file-emoji">🎵</div><span className="file-name">{file.name}</span></>
                  : <><div className="upload-arrow">↑</div><span>点击选择音频文件</span><span className="file-hint">MP3 · M4A · WAV · OGG</span></>
                }
                <input ref={fileRef} type="file"
                  accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                  style={{display:'none'}}
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {error && <div className="error-msg">⚠ {error}</div>}

            {loading ? (
              <div className="loading-state">
                <div className="dots"><span/><span/><span/></div>
                <p>{stageLabel[stage]}</p>
              </div>
            ) : (
              <button className="btn-process"
                onClick={run}
                disabled={inputMode==='url' ? !url.trim() : !file}
              >
                {hasResult ? '重新处理' : '开始处理'}
              </button>
            )}
          </div>

          {/* 进度 */}
          {(loading || hasResult) && (
            <div className="panel-section">
              <h2 className="section-title">处理进度</h2>
              <div className="progress-list">
                {[
                  { key: 'downloading', label: '下载音频', done: !!transcript },
                  { key: 'transcribing', label: '语音转录', done: !!transcript },
                  { key: 'summarizing', label: '生成摘要', done: !!summary },
                ].map(s => (
                  <div key={s.key} className={`prog-item ${stage===s.key?'active':''} ${s.done?'done':''}`}>
                    <span className="prog-dot">{s.done ? '✓' : ''}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 飞书存档 */}
          {summary && stage !== 'archiving' && (
            <div className="panel-section archive-section">
              <h2 className="section-title">存档到飞书</h2>
              {stage === 'done' ? (
                <div className="done-state">
                  <span className="done-check">✓</span>
                  <div>
                    <p>文档创建成功！</p>
                    <a href={docUrl} target="_blank" rel="noreferrer">打开飞书文档 ↗</a>
                  </div>
                </div>
              ) : (
                <>
                  <input type="text" placeholder="文档标题（可选）"
                    value={docTitle} onChange={e => setDocTitle(e.target.value)}
                    className="url-input"
                  />
                  <button className="btn-archive" onClick={handleArchive} disabled={loading}>
                    保存到飞书 →
                  </button>
                </>
              )}
            </div>
          )}
        </aside>

        {/* ── 右栏：结果 ── */}
        <main className="right-panel">
          {!hasResult ? (
            <div className="empty-state">
              <div className="empty-icon">🎙</div>
              <h3>上传音频开始处理</h3>
              <p>转录文本和摘要结果会显示在这里</p>
            </div>
          ) : (
            <div className="results">
              {/* 摘要（可编辑） */}
              {editedSummary && (
                <div className="result-block">
                  <div className="result-header">
                    <h3>✨ 摘要</h3>
                    <span className="edit-hint">可直接编辑</span>
                  </div>

                  <div className="edit-field">
                    <label>核心主题</label>
                    <textarea
                      value={editedSummary.core_topic}
                      onChange={e => setEditedSummary({...editedSummary, core_topic: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="edit-field">
                    <label>关键要点</label>
                    {editedSummary.key_points.map((p, i) => (
                      <div key={i} className="point-row">
                        <span className="point-num">{i+1}</span>
                        <textarea
                          value={p}
                          onChange={e => updateKeyPoint(i, e.target.value)}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="edit-field">
                    <label>结论</label>
                    <textarea
                      value={editedSummary.conclusion}
                      onChange={e => setEditedSummary({...editedSummary, conclusion: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="edit-field">
                    <label>适合人群</label>
                    <textarea
                      value={editedSummary.target_audience}
                      onChange={e => setEditedSummary({...editedSummary, target_audience: e.target.value})}
                      rows={1}
                    />
                  </div>
                </div>
              )}

              {/* 转录文本 */}
              {transcript && (
                <div className="result-block">
                  <div className="result-header">
                    <h3>📝 转录文本</h3>
                  </div>
                  <div className="transcript-text">{transcript}</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
