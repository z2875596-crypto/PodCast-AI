import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Summary {
  core_topic: string
  key_points: string[]
  conclusion: string
  target_audience: string
}

interface EnhanceResult {
  language: string
  translation: string | null
  keywords: string[]
}

interface HistoryItem {
  id: string
  title: string
  date: string
  transcript: string
  summary: Summary
  enhance?: EnhanceResult
  docUrl?: string
}

type Stage = 'idle' | 'downloading' | 'transcribing' | 'summarizing' | 'enhancing' | 'archiving' | 'done'
type Page = 'cover' | 'main'
type LeftTab = 'input' | 'history'

const API = '/api/v1'
const STORAGE_KEY = 'podcast_ai_history'

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// 高亮关键词：把文本中的关键词用 <mark> 包裹
function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords.length) return text
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text.replace(pattern, '<mark>$1</mark>')
}

export default function App() {
  const [page, setPage] = useState<Page>('cover')
  const [leftTab, setLeftTab] = useState<LeftTab>('input')
  const [inputMode, setInputMode] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [editedSummary, setEditedSummary] = useState<Summary | null>(null)
  const [enhance, setEnhance] = useState<EnhanceResult | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [docUrl, setDocUrl] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)
  const fileRef = useRef<HTMLInputElement>(null)

  const loading = ['downloading','transcribing','summarizing','enhancing','archiving'].includes(stage)

  const stageLabel: Record<Stage, string> = {
    idle: '', downloading: '正在下载音频…',
    transcribing: '正在转录，请稍候…',
    summarizing: '正在生成摘要…',
    enhancing: '正在提取关键词与翻译…',
    archiving: '正在创建飞书文档…',
    done: '',
  }

  // 自动保存历史
  useEffect(() => {
    if (summary && transcript) {
      const existing = loadHistory()
      const isDup = existing.length > 0 && existing[0].transcript === transcript
      if (!isDup) {
        const item: HistoryItem = {
          id: Date.now().toString(),
          title: summary.core_topic.slice(0, 40) || '播客摘要',
          date: new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
          transcript, summary,
          enhance: enhance || undefined,
          docUrl: docUrl || undefined,
        }
        const updated = [item, ...existing].slice(0, 20)
        setHistory(updated)
        saveHistory(updated)
      }
    }
  }, [summary])

  useEffect(() => {
    if (docUrl && history.length > 0) {
      const updated = history.map((h, i) => i === 0 ? { ...h, docUrl } : h)
      setHistory(updated)
      saveHistory(updated)
    }
  }, [docUrl])

  function loadFromHistory(item: HistoryItem) {
    setTranscript(item.transcript)
    setSummary(item.summary)
    setEditedSummary(item.summary)
    setEnhance(item.enhance || null)
    setDocUrl(item.docUrl || '')
    setDocTitle('')
    setStage(item.docUrl ? 'done' : 'idle')
    setError('')
    setLeftTab('input')
  }

  function deleteHistory(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = history.filter(h => h.id !== id)
    setHistory(updated); saveHistory(updated)
  }

  function clearAllHistory() { setHistory([]); saveHistory([]) }

  function handleCoverClick() { setPage('main') }

  async function run() {
    setError('')
    setTranscript(''); setSummary(null); setEditedSummary(null)
    setEnhance(null); setDocUrl(''); setShowTranslation(false)
    try {
      // 1. 下载/上传
      setStage('downloading')
      let res: Response
      if (inputMode === 'url') {
        res = await fetch(`${API}/audio/download`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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

      // 2. 转录
      setStage('transcribing')
      res = await fetch(`${API}/transcribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '转录失败')
      const transcriptText = data.text
      setTranscript(transcriptText)

      // 3. 摘要
      setStage('summarizing')
      res = await fetch(`${API}/summarize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcriptText }),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '摘要失败')
      setSummary(data); setEditedSummary(data)

      // 4. 关键词 + 翻译
      setStage('enhancing')
      res = await fetch(`${API}/enhance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcriptText }),
      })
      data = await res.json()
      if (res.ok) {
        setEnhance(data)
        if (data.translation) setShowTranslation(true)
      }

      setStage('idle')
    } catch (e: any) {
      setError(e.message)
      setStage('idle')
    }
  }

  async function handleArchive() {
    setError(''); setStage('archiving')
    try {
      const res = await fetch(`${API}/feishu/create-doc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle || editedSummary?.core_topic || '播客摘要',
          transcript, summary: editedSummary,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message || '创建文档失败')
      setDocUrl(data.doc_url); setStage('done')
    } catch (e: any) {
      setError(e.message); setStage('idle')
    }
  }

  function updateKeyPoint(i: number, val: string) {
    if (!editedSummary) return
    const kp = [...editedSummary.key_points]; kp[i] = val
    setEditedSummary({ ...editedSummary, key_points: kp })
  }

  const hasResult = !!(transcript || summary)

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
          <div className="circle c1" /><div className="circle c2" /><div className="circle c3" />
        </div>
      </div>
    )
  }

  // ── 主页面 ──────────────────────────────────────────────────
  return (
    <div className="main-app">
      <nav className="topbar">
        <div className="topbar-logo" onClick={() => setPage('cover')}>
          <span className="topbar-icon">◎</span>
          <span>PodCast<em>AI</em></span>
        </div>
        {hasResult && (
          <button className="btn-new" onClick={() => {
            setTranscript(''); setSummary(null); setEditedSummary(null)
            setEnhance(null); setDocUrl(''); setUrl(''); setFile(null)
            setError(''); setStage('idle'); setLeftTab('input')
          }}>+ 新建</button>
        )}
      </nav>

      <div className="workspace">
        {/* ── 左栏 ── */}
        <aside className="left-panel">
          <div className="left-tabs">
            <button className={`left-tab ${leftTab==='input'?'active':''}`} onClick={() => setLeftTab('input')}>处理</button>
            <button className={`left-tab ${leftTab==='history'?'active':''}`} onClick={() => setLeftTab('history')}>
              历史 {history.length > 0 && <span className="history-badge">{history.length}</span>}
            </button>
          </div>

          {/* 输入面板 */}
          {leftTab === 'input' && (
            <>
              <div className="panel-section">
                <h2 className="section-title">音频来源</h2>
                <div className="tab-row">
                  <button className={`tab ${inputMode==='url'?'active':''}`} onClick={()=>setInputMode('url')}>🔗 URL</button>
                  <button className={`tab ${inputMode==='file'?'active':''}`} onClick={()=>setInputMode('file')}>📁 上传文件</button>
                </div>
                {inputMode === 'url' ? (
                  <input type="url" placeholder="粘贴播客链接…"
                    value={url} onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && !loading && run()}
                    className="url-input" />
                ) : (
                  <div className="file-zone" onClick={() => fileRef.current?.click()}>
                    {file
                      ? <><div className="file-emoji">🎵</div><span className="file-name">{file.name}</span></>
                      : <><div className="upload-arrow">↑</div><span>点击选择音频文件</span><span className="file-hint">MP3 · M4A · WAV · OGG</span></>
                    }
                    <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                      style={{display:'none'}} onChange={e => setFile(e.target.files?.[0] || null)} />
                  </div>
                )}
                {error && <div className="error-msg">⚠ {error}</div>}
                {loading ? (
                  <div className="loading-state">
                    <div className="dots"><span/><span/><span/></div>
                    <p>{stageLabel[stage]}</p>
                  </div>
                ) : (
                  <button className="btn-process" onClick={run}
                    disabled={inputMode==='url' ? !url.trim() : !file}>
                    {hasResult ? '重新处理' : '开始处理'}
                  </button>
                )}
              </div>

              {(loading || hasResult) && (
                <div className="panel-section">
                  <h2 className="section-title">处理进度</h2>
                  <div className="progress-list">
                    {[
                      { key: 'downloading', label: '下载音频', done: !!transcript },
                      { key: 'transcribing', label: '语音转录', done: !!transcript },
                      { key: 'summarizing',  label: '生成摘要', done: !!summary },
                      { key: 'enhancing',    label: '关键词与翻译', done: !!enhance },
                    ].map(s => (
                      <div key={s.key} className={`prog-item ${stage===s.key?'active':''} ${s.done?'done':''}`}>
                        <span className="prog-dot">{s.done ? '✓' : ''}</span>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 关键词展示 */}
              {enhance && enhance.keywords.length > 0 && (
                <div className="panel-section">
                  <h2 className="section-title">关键词</h2>
                  <div className="keywords-cloud">
                    {enhance.keywords.map((kw, i) => (
                      <span key={i} className="keyword-tag">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

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
                        className="url-input" />
                      <button className="btn-archive" onClick={handleArchive} disabled={loading}>
                        保存到飞书 →
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* 历史面板 */}
          {leftTab === 'history' && (
            <div className="history-panel">
              {history.length === 0 ? (
                <div className="history-empty">
                  <span>🕐</span><p>暂无历史记录</p><p>处理完成后会自动保存</p>
                </div>
              ) : (
                <>
                  <div className="history-header">
                    <span>{history.length} 条记录</span>
                    <button className="btn-clear" onClick={clearAllHistory}>清空</button>
                  </div>
                  <div className="history-list">
                    {history.map(item => (
                      <div key={item.id} className="history-item" onClick={() => loadFromHistory(item)}>
                        <div className="history-item-top">
                          <span className="history-title">{item.title}</span>
                          <button className="history-del" onClick={e => deleteHistory(item.id, e)}>×</button>
                        </div>
                        <div className="history-meta">
                          <span className="history-date">🕐 {item.date}</span>
                          {item.docUrl && <span className="history-tag">已存飞书</span>}
                          {item.enhance?.translation && <span className="history-tag-trans">含翻译</span>}
                        </div>
                        <p className="history-preview">{item.transcript.slice(0, 60)}…</p>
                      </div>
                    ))}
                  </div>
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
              {history.length > 0 && (
                <button className="btn-history-hint" onClick={() => setLeftTab('history')}>
                  查看 {history.length} 条历史记录 →
                </button>
              )}
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
                    <textarea value={editedSummary.core_topic}
                      onChange={e => setEditedSummary({...editedSummary, core_topic: e.target.value})}
                      rows={2} />
                  </div>
                  <div className="edit-field">
                    <label>关键要点</label>
                    {editedSummary.key_points.map((p, i) => (
                      <div key={i} className="point-row">
                        <span className="point-num">{i+1}</span>
                        <textarea value={p} onChange={e => updateKeyPoint(i, e.target.value)} rows={2} />
                      </div>
                    ))}
                  </div>
                  <div className="edit-field">
                    <label>结论</label>
                    <textarea value={editedSummary.conclusion}
                      onChange={e => setEditedSummary({...editedSummary, conclusion: e.target.value})}
                      rows={2} />
                  </div>
                  <div className="edit-field">
                    <label>适合人群</label>
                    <textarea value={editedSummary.target_audience}
                      onChange={e => setEditedSummary({...editedSummary, target_audience: e.target.value})}
                      rows={1} />
                  </div>
                </div>
              )}

              {/* 转录文本（含高亮 + 翻译切换） */}
              {transcript && (
                <div className="result-block">
                  <div className="result-header">
                    <h3>📝 转录文本</h3>
                    {enhance?.translation && (
                      <div className="lang-toggle">
                        <button
                          className={`lang-btn ${!showTranslation ? 'active' : ''}`}
                          onClick={() => setShowTranslation(false)}
                        >
                          原文
                        </button>
                        <button
                          className={`lang-btn ${showTranslation ? 'active' : ''}`}
                          onClick={() => setShowTranslation(true)}
                        >
                          中文翻译
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 语言标签 */}
                  {enhance && (
                    <div className="lang-badge">
                      {enhance.language === 'zh' ? '🇨🇳 中文' :
                       enhance.language === 'en' ? '🇺🇸 English' :
                       enhance.language === 'ja' ? '🇯🇵 日本語' :
                       `🌐 ${enhance.language.toUpperCase()}`}
                    </div>
                  )}

                  {showTranslation && enhance?.translation ? (
                    <div className="transcript-text translation-text">
                      {enhance.translation}
                    </div>
                  ) : (
                    <div
                      className="transcript-text"
                      dangerouslySetInnerHTML={{
                        __html: enhance?.keywords?.length
                          ? highlightKeywords(transcript, enhance.keywords)
                          : transcript.replace(/\n/g, '<br/>')
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
