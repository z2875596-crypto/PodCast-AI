import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

// ── 类型定义 ────────────────────────────────────────────────
interface Summary {
  core_topic: string; key_points: string[]
  conclusion: string; target_audience: string
}
interface EnhanceResult {
  language: string; translation: string | null; keywords: string[]
}
interface Definition { pos: string; meaning: string; english_def: string }
interface Phrase { phrase: string; meaning: string }
interface Example { en: string; zh: string }
interface WordDetail {
  word: string; phonetic: string; level: string
  definitions: Definition[]; phrases: Phrase[]; examples: Example[]
}
interface VocabItem {
  id: string; word: string; phonetic: string; level: string
  definitions: Definition[]; phrases: Phrase[]; examples: Example[]
  addedAt: string
}
interface HistoryItem {
  id: string; title: string; date: string
  transcript: string; summary: Summary
  enhance?: EnhanceResult; docUrl?: string
}
interface Segment {
  id: number; start: number
  text: string; translation: string; difficulty: string
}

type Stage = 'idle'|'downloading'|'transcribing'|'summarizing'|'enhancing'|'archiving'|'done'
type Page = 'cover'|'main'|'listen'
type LeftTab = 'input'|'history'|'vocab'

const API = '/api/v1'
const HISTORY_KEY = 'podcast_ai_history'
const VOCAB_KEY   = 'podcast_ai_vocab'

function loadLS<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function saveLS(key: string, data: unknown[]) {
  localStorage.setItem(key, JSON.stringify(data))
}
function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords.length) return text.replace(/\n/g, '<br/>')
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return text.replace(/\n/g, '<br/>')
    .replace(new RegExp(`(${escaped.join('|')})`, 'gi'), '<mark>$1</mark>')
}
function levelColor(level: string) {
  if (level === 'beginner')     return '#16a34a'
  if (level === 'intermediate') return '#d97706'
  return '#dc2626'
}
function levelLabel(level: string) {
  if (level === 'beginner')     return '初级'
  if (level === 'intermediate') return '中级'
  return '高级'
}
function diffColor(d: string) {
  if (d === 'easy')   return '#16a34a'
  if (d === 'medium') return '#d97706'
  return '#dc2626'
}
function diffLabel(d: string) {
  if (d === 'easy')   return '简单'
  if (d === 'medium') return '中等'
  return '困难'
}
function fmtTime(sec: number) {
  const m = Math.floor(sec/60).toString().padStart(2,'0')
  const s = (sec%60).toString().padStart(2,'0')
  return `${m}:${s}`
}

// ══════════════════════════════════════════════════════════════
//  精听页面组件
// ══════════════════════════════════════════════════════════════
function ListenPage({
  audioFile, audioUrl, transcript, onBack, onLookup
}: {
  audioFile: File|null
  audioUrl: string
  transcript: string
  onBack: () => void
  onLookup: (word: string) => void
}) {
  const [segments, setSegments]       = useState<Segment[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [activeId, setActiveId]       = useState<number|null>(null)
  const [loopId, setLoopId]           = useState<number|null>(null)
  const [showTrans, setShowTrans]     = useState<Record<number,boolean>>({})
  const [showAllTrans, setShowAllTrans] = useState(false)
  const [speed, setSpeed]             = useState(1)
  const audioRef  = useRef<HTMLAudioElement>(null)
  const segRefs   = useRef<Record<number, HTMLDivElement|null>>({})
  const objectUrl = useRef<string>('')

  // 创建音频 URL
  useEffect(() => {
    if (audioFile) {
      objectUrl.current = URL.createObjectURL(audioFile)
    }
    return () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }
  }, [audioFile])

  const src = audioFile ? objectUrl.current : audioUrl

  // 加载句子
  useEffect(() => {
    if (!transcript) return
    setLoading(true); setError('')
    fetch(`${API}/segments`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: transcript }),
    })
      .then(r => r.json())
      .then(d => { setSegments(d.segments||[]); setLoading(false) })
      .catch(() => { setError('切割失败，请重试'); setLoading(false) })
  }, [transcript])

  // 音频时间同步高亮当前句子
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !segments.length) return
    function onTime() {
      const t = audio!.currentTime
      const cur = [...segments].reverse().find(s => s.start <= t)
      if (cur) {
        setActiveId(cur.id)
        segRefs.current[cur.id]?.scrollIntoView({ behavior:'smooth', block:'nearest' })
      }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [segments])

  // 单句循环
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || loopId === null) return
    const seg = segments.find(s => s.id === loopId)
    if (!seg) return
    const next = segments.find(s => s.id > loopId)
    function onTime() {
      if (!audio) return
      const end = next ? next.start : audio.duration
      if (audio.currentTime >= end) {
        audio.currentTime = seg!.start
        audio.play()
      }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [loopId, segments])

  function playSeg(seg: Segment) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seg.start
    audio.playbackRate = speed
    audio.play()
    setActiveId(seg.id)
  }

  function toggleLoop(id: number) {
    setLoopId(prev => prev === id ? null : id)
  }

  function toggleTrans(id: number) {
    setShowTrans(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function changeSpeed(s: number) {
    setSpeed(s)
    if (audioRef.current) audioRef.current.playbackRate = s
  }

  return (
    <div className="listen-page">
      {/* 顶栏 */}
      <nav className="topbar">
        <button className="btn-back" onClick={onBack}>← 返回</button>
        <div className="topbar-logo">
          <span className="topbar-icon">◎</span>
          <span>精听模式</span>
        </div>
        <div className="topbar-right">
          <button
            className={`btn-trans-toggle ${showAllTrans?'active':''}`}
            onClick={()=>setShowAllTrans(v=>!v)}
          >
            {showAllTrans ? '隐藏翻译' : '显示全部翻译'}
          </button>
        </div>
      </nav>

      <div className="listen-layout">
        {/* 左：句子列表 */}
        <div className="listen-left">
          {loading && (
            <div className="listen-loading">
              <div className="dots"><span/><span/><span/></div>
              <p>正在切割句子…</p>
            </div>
          )}
          {error && <div className="error-msg">⚠ {error}</div>}
          {!loading && segments.length > 0 && (
            <div className="seg-list">
              {segments.map(seg => (
                <div
                  key={seg.id}
                  ref={el => segRefs.current[seg.id] = el}
                  className={`seg-item ${activeId===seg.id?'active':''} ${loopId===seg.id?'looping':''}`}
                  onClick={()=>playSeg(seg)}
                >
                  <div className="seg-top">
                    <span className="seg-time">{fmtTime(seg.start)}</span>
                    <span className="seg-diff" style={{color:diffColor(seg.difficulty)}}>
                      {diffLabel(seg.difficulty)}
                    </span>
                    <div className="seg-actions" onClick={e=>e.stopPropagation()}>
                      <button
                        className={`seg-btn ${loopId===seg.id?'active':''}`}
                        title="单句循环"
                        onClick={()=>toggleLoop(seg.id)}
                      >🔁</button>
                      <button
                        className="seg-btn"
                        title="查词"
                        onClick={()=>{
                          const sel = window.getSelection()?.toString().trim()
                          if (sel) onLookup(sel)
                        }}
                      >🔍</button>
                      <button
                        className={`seg-btn ${(showTrans[seg.id]||showAllTrans)?'active':''}`}
                        title="切换翻译"
                        onClick={()=>toggleTrans(seg.id)}
                      >译</button>
                    </div>
                  </div>
                  <p className="seg-text">{seg.text}</p>
                  {(showTrans[seg.id] || showAllTrans) && (
                    <p className="seg-trans">{seg.translation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右：播放器 */}
        <div className="listen-right">
          <div className="player-card">
            <div className="player-title">
              {loopId !== null
                ? <><span className="loop-badge">🔁 循环中</span> 第 {loopId} 句</>
                : activeId !== null ? `第 ${activeId} 句` : '点击句子开始播放'
              }
            </div>

            {/* 当前句子展示 */}
            {activeId !== null && segments.find(s=>s.id===activeId) && (
              <div className="player-seg-display">
                <p className="player-seg-text">
                  {segments.find(s=>s.id===activeId)?.text}
                </p>
                <p className="player-seg-trans">
                  {segments.find(s=>s.id===activeId)?.translation}
                </p>
              </div>
            )}

            {/* 音频播放器 */}
            {src ? (
              <audio
                ref={audioRef}
                src={src}
                controls
                className="audio-player"
                onPlay={e=>{(e.target as HTMLAudioElement).playbackRate = speed}}
              />
            ) : (
              <div className="no-audio">
                <p>⚠ 无法加载音频</p>
                <p>请通过「上传文件」方式添加音频</p>
              </div>
            )}

            {/* 速度控制 */}
            <div className="speed-control">
              <span className="speed-label">播放速度</span>
              <div className="speed-btns">
                {[0.5, 0.75, 1, 1.25, 1.5].map(s => (
                  <button
                    key={s}
                    className={`speed-btn ${speed===s?'active':''}`}
                    onClick={()=>changeSpeed(s)}
                  >{s}x</button>
                ))}
              </div>
            </div>

            {/* 统计 */}
            {segments.length > 0 && (
              <div className="listen-stats">
                <div className="stat-item">
                  <span className="stat-num">{segments.length}</span>
                  <span className="stat-label">句子</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num" style={{color:'#16a34a'}}>
                    {segments.filter(s=>s.difficulty==='easy').length}
                  </span>
                  <span className="stat-label">简单</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num" style={{color:'#d97706'}}>
                    {segments.filter(s=>s.difficulty==='medium').length}
                  </span>
                  <span className="stat-label">中等</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num" style={{color:'#dc2626'}}>
                    {segments.filter(s=>s.difficulty==='hard').length}
                  </span>
                  <span className="stat-label">困难</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  主组件
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage]               = useState<Page>('cover')
  const [leftTab, setLeftTab]         = useState<LeftTab>('input')
  const [inputMode, setInputMode]     = useState<'url'|'file'>('url')
  const [url, setUrl]                 = useState('')
  const [file, setFile]               = useState<File|null>(null)
  const [audioPath, setAudioPath]     = useState('')
  const [transcript, setTranscript]   = useState('')
  const [summary, setSummary]         = useState<Summary|null>(null)
  const [editedSummary, setEditedSummary] = useState<Summary|null>(null)
  const [enhance, setEnhance]         = useState<EnhanceResult|null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [docUrl, setDocUrl]           = useState('')
  const [docTitle, setDocTitle]       = useState('')
  const [stage, setStage]             = useState<Stage>('idle')
  const [error, setError]             = useState('')
  const [history, setHistory]         = useState<HistoryItem[]>(() => loadLS(HISTORY_KEY))
  const [vocab, setVocab]             = useState<VocabItem[]>(() => loadLS(VOCAB_KEY))

  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchWord, setSearchWord]   = useState('')
  const [searchResult, setSearchResult] = useState<WordDetail|null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const loading = ['downloading','transcribing','summarizing','enhancing','archiving'].includes(stage)
  const stageLabel: Record<Stage,string> = {
    idle:'', downloading:'正在下载音频…', transcribing:'正在转录，请稍候…',
    summarizing:'正在生成摘要…', enhancing:'正在提取关键词与翻译…',
    archiving:'正在创建飞书文档…', done:'',
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setSearchOpen(o=>!o) }
      if (e.key==='Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (searchOpen) setTimeout(()=>searchRef.current?.focus(),50) }, [searchOpen])

  useEffect(() => {
    if (summary && transcript) {
      const existing = loadLS<HistoryItem>(HISTORY_KEY)
      if (existing[0]?.transcript === transcript) return
      const item: HistoryItem = {
        id: Date.now().toString(),
        title: summary.core_topic.slice(0,40)||'播客摘要',
        date: new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
        transcript, summary, enhance: enhance||undefined, docUrl: docUrl||undefined,
      }
      const updated = [item,...existing].slice(0,20)
      setHistory(updated); saveLS(HISTORY_KEY, updated)
    }
  }, [summary])

  useEffect(() => {
    if (docUrl && history.length>0) {
      const updated = history.map((h,i)=>i===0?{...h,docUrl}:h)
      setHistory(updated); saveLS(HISTORY_KEY, updated)
    }
  }, [docUrl])

  const lookupWord = useCallback(async (word: string) => {
    if (!word.trim()) return
    setSearchWord(word.trim())
    setSearchOpen(true)
    setSearchLoading(true); setSearchError(''); setSearchResult(null)
    try {
      const res = await fetch(`${API}/word`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({word: word.trim()}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'查词失败')
      setSearchResult(data)
    } catch(e:any) { setSearchError(e.message) }
    finally { setSearchLoading(false) }
  }, [])

  function addToVocab(detail: WordDetail) {
    const existing = loadLS<VocabItem>(VOCAB_KEY)
    if (existing.find(v=>v.word.toLowerCase()===detail.word.toLowerCase())) return
    const item: VocabItem = {
      ...detail, id: Date.now().toString(),
      addedAt: new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
    }
    const updated = [item,...existing]
    setVocab(updated); saveLS(VOCAB_KEY, updated)
  }
  function removeFromVocab(id:string) {
    const updated = vocab.filter(v=>v.id!==id); setVocab(updated); saveLS(VOCAB_KEY, updated)
  }
  function isInVocab(word:string) { return vocab.some(v=>v.word.toLowerCase()===word.toLowerCase()) }

  function loadFromHistory(item: HistoryItem) {
    setTranscript(item.transcript); setSummary(item.summary)
    setEditedSummary(item.summary); setEnhance(item.enhance||null)
    setDocUrl(item.docUrl||''); setDocTitle('')
    setStage(item.docUrl?'done':'idle'); setError(''); setLeftTab('input')
  }
  function deleteHistory(id:string, e:React.MouseEvent) {
    e.stopPropagation()
    const updated = history.filter(h=>h.id!==id); setHistory(updated); saveLS(HISTORY_KEY,updated)
  }
  function clearAllHistory() { setHistory([]); saveLS(HISTORY_KEY,[]) }

  async function run() {
    setError(''); setTranscript(''); setSummary(null); setEditedSummary(null)
    setEnhance(null); setDocUrl(''); setShowTranslation(false); setAudioPath('')
    try {
      setStage('downloading')
      let res: Response
      if (inputMode==='url') {
        res = await fetch(`${API}/audio/download`,{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({url}),
        })
      } else {
        if (!file) throw new Error('请选择音频文件')
        const form = new FormData(); form.append('file',file)
        res = await fetch(`${API}/audio/upload`,{method:'POST',body:form})
      }
      let data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'音频处理失败')
      setAudioPath(data.path)

      setStage('transcribing')
      res = await fetch(`${API}/transcribe`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({path:data.path}),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'转录失败')
      const transcriptText = data.text; setTranscript(transcriptText)

      setStage('summarizing')
      res = await fetch(`${API}/summarize`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text:transcriptText}),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'摘要失败')
      setSummary(data); setEditedSummary(data)

      setStage('enhancing')
      res = await fetch(`${API}/enhance`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text:transcriptText}),
      })
      data = await res.json()
      if (res.ok) { setEnhance(data) }

      setStage('idle')
    } catch(e:any) { setError(e.message); setStage('idle') }
  }

  async function handleArchive() {
    setError(''); setStage('archiving')
    try {
      const res = await fetch(`${API}/feishu/create-doc`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: docTitle||editedSummary?.core_topic||'播客摘要',
          transcript, summary: editedSummary,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'创建文档失败')
      setDocUrl(data.doc_url); setStage('done')
    } catch(e:any) { setError(e.message); setStage('idle') }
  }

  function updateKeyPoint(i:number, val:string) {
    if (!editedSummary) return
    const kp=[...editedSummary.key_points]; kp[i]=val
    setEditedSummary({...editedSummary,key_points:kp})
  }

  const hasResult = !!(transcript||summary)

  // ── 封面页 ──────────────────────────────────────────────
  if (page==='cover') return (
    <div className="cover" onClick={()=>setPage('main')}>
      <div className="cover-bg"/>
      <div className="cover-content">
        <div className="cover-logo">
          <span className="cover-icon">◎</span>
          <h1 className="cover-title">PodCast<em>AI</em></h1>
        </div>
        <p className="cover-sub">播客音频 · 智能转录 · 英语精听</p>
        <div className="cover-hint">点击任意位置开始 →</div>
      </div>
      <div className="cover-circles">
        <div className="circle c1"/><div className="circle c2"/><div className="circle c3"/>
      </div>
    </div>
  )

  // ── 精听页面 ─────────────────────────────────────────────
  if (page==='listen') return (
    <>
      <ListenPage
        audioFile={inputMode==='file' ? file : null}
        audioUrl={inputMode==='url' ? url : ''}
        transcript={transcript}
        onBack={()=>setPage('main')}
        onLookup={(word)=>lookupWord(word)}
      />
      {searchOpen && renderSearchModal()}
    </>
  )

  // ── 主页面 ──────────────────────────────────────────────
  function renderSearchModal() {
    return (
      <div className="search-overlay" onClick={()=>setSearchOpen(false)}>
        <div className="search-modal" onClick={e=>e.stopPropagation()}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input ref={searchRef} type="text"
              placeholder="输入英文单词查询… (Esc 关闭)"
              value={searchWord} onChange={e=>setSearchWord(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') lookupWord(searchWord); if(e.key==='Escape') setSearchOpen(false) }}
              className="search-input"
            />
            {searchWord && <button className="search-go" onClick={()=>lookupWord(searchWord)}>查询</button>}
            <button className="search-close" onClick={()=>setSearchOpen(false)}>×</button>
          </div>
          <div className="search-body">
            {searchLoading && <div className="search-loading"><div className="dots"><span/><span/><span/></div><p>查询中…</p></div>}
            {searchError && <div className="error-msg">⚠ {searchError}</div>}
            {searchResult && !searchLoading && (
              <div className="word-result">
                <div className="word-header">
                  <div className="word-main">
                    <h2 className="word-title">{searchResult.word}</h2>
                    <span className="word-phonetic">{searchResult.phonetic}</span>
                    <span className="word-level-badge" style={{background:`${levelColor(searchResult.level)}18`,color:levelColor(searchResult.level)}}>
                      {levelLabel(searchResult.level)}
                    </span>
                  </div>
                  <button className={`btn-add-vocab ${isInVocab(searchResult.word)?'added':''}`}
                    onClick={()=>!isInVocab(searchResult.word)&&addToVocab(searchResult)}>
                    {isInVocab(searchResult.word)?'✓ 已加入':'+ 加入生词本'}
                  </button>
                </div>
                <div className="word-section">
                  <h4>释义</h4>
                  {searchResult.definitions.map((d,i)=>(
                    <div key={i} className="word-def">
                      <span className="word-pos">{d.pos}</span>
                      <div><div className="word-meaning-zh">{d.meaning}</div><div className="word-meaning-en">{d.english_def}</div></div>
                    </div>
                  ))}
                </div>
                <div className="word-section">
                  <h4>常用短语</h4>
                  <div className="phrase-list">
                    {searchResult.phrases.map((p,i)=>(
                      <div key={i} className="phrase-item">
                        <span className="phrase-en">{p.phrase}</span>
                        <span className="phrase-zh">{p.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="word-section">
                  <h4>例句</h4>
                  {searchResult.examples.map((ex,i)=>(
                    <div key={i} className="example-item">
                      <p className="example-en">{ex.en}</p>
                      <p className="example-zh">{ex.zh}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!searchLoading && !searchResult && !searchError && (
              <div className="search-hint">
                <p>💡 使用方法</p>
                <ul>
                  <li>输入单词后按 Enter 查询</li>
                  <li>在转录文本中双击单词快速查询</li>
                  <li>精听页面选中单词后点 🔍 查词</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main-app">
      <nav className="topbar">
        <div className="topbar-logo" onClick={()=>setPage('cover')}>
          <span className="topbar-icon">◎</span>
          <span>PodCast<em>AI</em></span>
        </div>
        <div className="topbar-right">
          {transcript && (
            <button className="btn-listen" onClick={()=>setPage('listen')}>
              🎧 精听模式
            </button>
          )}
          <button className="btn-search-trigger" onClick={()=>setSearchOpen(true)}>
            🔍 查词 <kbd>⌘K</kbd>
          </button>
          {hasResult && (
            <button className="btn-new" onClick={()=>{
              setTranscript(''); setSummary(null); setEditedSummary(null)
              setEnhance(null); setDocUrl(''); setUrl(''); setFile(null)
              setError(''); setStage('idle'); setLeftTab('input'); setAudioPath('')
            }}>+ 新建</button>
          )}
        </div>
      </nav>

      <div className="workspace">
        <aside className="left-panel">
          <div className="left-tabs">
            <button className={`left-tab ${leftTab==='input'?'active':''}`} onClick={()=>setLeftTab('input')}>处理</button>
            <button className={`left-tab ${leftTab==='vocab'?'active':''}`} onClick={()=>setLeftTab('vocab')}>
              生词本 {vocab.length>0 && <span className="history-badge">{vocab.length}</span>}
            </button>
            <button className={`left-tab ${leftTab==='history'?'active':''}`} onClick={()=>setLeftTab('history')}>
              历史 {history.length>0 && <span className="history-badge">{history.length}</span>}
            </button>
          </div>

          {leftTab==='input' && <>
            <div className="panel-section">
              <h2 className="section-title">音频来源</h2>
              <div className="tab-row">
                <button className={`tab ${inputMode==='url'?'active':''}`} onClick={()=>setInputMode('url')}>🔗 URL</button>
                <button className={`tab ${inputMode==='file'?'active':''}`} onClick={()=>setInputMode('file')}>📁 上传文件</button>
              </div>
              {inputMode==='url'
                ? <input type="url" placeholder="粘贴播客链接…" value={url}
                    onChange={e=>setUrl(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!loading&&run()}
                    className="url-input"/>
                : <div className="file-zone" onClick={()=>fileRef.current?.click()}>
                    {file
                      ? <><div className="file-emoji">🎵</div><span className="file-name">{file.name}</span></>
                      : <><div className="upload-arrow">↑</div><span>点击选择音频文件</span><span className="file-hint">MP3 · M4A · WAV · OGG</span></>}
                    <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                      style={{display:'none'}} onChange={e=>setFile(e.target.files?.[0]||null)}/>
                  </div>
              }
              {error && <div className="error-msg">⚠ {error}</div>}
              {loading
                ? <div className="loading-state"><div className="dots"><span/><span/><span/></div><p>{stageLabel[stage]}</p></div>
                : <button className="btn-process" onClick={run} disabled={inputMode==='url'?!url.trim():!file}>
                    {hasResult?'重新处理':'开始处理'}
                  </button>
              }
              {transcript && !loading && (
                <button className="btn-listen-side" onClick={()=>setPage('listen')}>
                  🎧 进入精听模式 →
                </button>
              )}
            </div>

            {(loading||hasResult) && (
              <div className="panel-section">
                <h2 className="section-title">处理进度</h2>
                <div className="progress-list">
                  {[
                    {key:'downloading',label:'下载音频',done:!!transcript},
                    {key:'transcribing',label:'语音转录',done:!!transcript},
                    {key:'summarizing',label:'生成摘要',done:!!summary},
                    {key:'enhancing',label:'关键词与翻译',done:!!enhance},
                  ].map(s=>(
                    <div key={s.key} className={`prog-item ${stage===s.key?'active':''} ${s.done?'done':''}`}>
                      <span className="prog-dot">{s.done?'✓':''}</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {enhance?.keywords.length && (
              <div className="panel-section">
                <h2 className="section-title">关键词</h2>
                <div className="keywords-cloud">
                  {enhance.keywords.map((kw,i)=>(
                    <span key={i} className="keyword-tag"
                      onClick={()=>lookupWord(kw)}>{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {summary && stage!=='archiving' && (
              <div className="panel-section archive-section">
                <h2 className="section-title">存档到飞书</h2>
                {stage==='done'
                  ? <div className="done-state">
                      <span className="done-check">✓</span>
                      <div><p>文档创建成功！</p><a href={docUrl} target="_blank" rel="noreferrer">打开飞书文档 ↗</a></div>
                    </div>
                  : <>
                      <input type="text" placeholder="文档标题（可选）" value={docTitle}
                        onChange={e=>setDocTitle(e.target.value)} className="url-input"/>
                      <button className="btn-archive" onClick={handleArchive} disabled={loading}>保存到飞书 →</button>
                    </>
                }
              </div>
            )}
          </>}

          {leftTab==='vocab' && (
            <div className="history-panel">
              {vocab.length===0
                ? <div className="history-empty"><span>📖</span><p>生词本是空的</p><p>在查词窗口点「加入生词本」</p></div>
                : <>
                    <div className="history-header">
                      <span>{vocab.length} 个单词</span>
                      <button className="btn-clear" onClick={()=>{setVocab([]);saveLS(VOCAB_KEY,[])}}>清空</button>
                    </div>
                    <div className="history-list">
                      {vocab.map(item=>(
                        <div key={item.id} className="vocab-item">
                          <div className="vocab-item-top">
                            <div><span className="vocab-word">{item.word}</span><span className="vocab-phonetic">{item.phonetic}</span></div>
                            <div className="vocab-item-actions">
                              <span className="vocab-level" style={{color:levelColor(item.level)}}>{levelLabel(item.level)}</span>
                              <button className="history-del" onClick={()=>removeFromVocab(item.id)}>×</button>
                            </div>
                          </div>
                          <div className="vocab-meanings">
                            {item.definitions.slice(0,2).map((d,i)=>(
                              <span key={i} className="vocab-meaning"><em>{d.pos}</em> {d.meaning}</span>
                            ))}
                          </div>
                          <button className="vocab-lookup-btn" onClick={()=>lookupWord(item.word)}>查看详情 →</button>
                        </div>
                      ))}
                    </div>
                  </>
              }
            </div>
          )}

          {leftTab==='history' && (
            <div className="history-panel">
              {history.length===0
                ? <div className="history-empty"><span>🕐</span><p>暂无历史记录</p><p>处理完成后会自动保存</p></div>
                : <>
                    <div className="history-header">
                      <span>{history.length} 条记录</span>
                      <button className="btn-clear" onClick={clearAllHistory}>清空</button>
                    </div>
                    <div className="history-list">
                      {history.map(item=>(
                        <div key={item.id} className="history-item" onClick={()=>loadFromHistory(item)}>
                          <div className="history-item-top">
                            <span className="history-title">{item.title}</span>
                            <button className="history-del" onClick={e=>deleteHistory(item.id,e)}>×</button>
                          </div>
                          <div className="history-meta">
                            <span className="history-date">🕐 {item.date}</span>
                            {item.docUrl && <span className="history-tag">已存飞书</span>}
                            {item.enhance?.translation && <span className="history-tag-trans">含翻译</span>}
                          </div>
                          <p className="history-preview">{item.transcript.slice(0,60)}…</p>
                        </div>
                      ))}
                    </div>
                  </>
              }
            </div>
          )}
        </aside>

        <main className="right-panel">
          {!hasResult
            ? <div className="empty-state">
                <div className="empty-icon">🎙</div>
                <h3>上传音频开始处理</h3>
                <p>转录文本和摘要结果会显示在这里</p>
                <button className="btn-search-trigger mt" onClick={()=>setSearchOpen(true)}>🔍 或直接查词 ⌘K</button>
                {history.length>0 && (
                  <button className="btn-history-hint" onClick={()=>setLeftTab('history')}>
                    查看 {history.length} 条历史记录 →
                  </button>
                )}
              </div>
            : <div className="results">
                {editedSummary && (
                  <div className="result-block">
                    <div className="result-header"><h3>✨ 摘要</h3><span className="edit-hint">可直接编辑</span></div>
                    <div className="edit-field"><label>核心主题</label>
                      <textarea value={editedSummary.core_topic}
                        onChange={e=>setEditedSummary({...editedSummary,core_topic:e.target.value})} rows={2}/>
                    </div>
                    <div className="edit-field"><label>关键要点</label>
                      {editedSummary.key_points.map((p,i)=>(
                        <div key={i} className="point-row">
                          <span className="point-num">{i+1}</span>
                          <textarea value={p} onChange={e=>updateKeyPoint(i,e.target.value)} rows={2}/>
                        </div>
                      ))}
                    </div>
                    <div className="edit-field"><label>结论</label>
                      <textarea value={editedSummary.conclusion}
                        onChange={e=>setEditedSummary({...editedSummary,conclusion:e.target.value})} rows={2}/>
                    </div>
                    <div className="edit-field"><label>适合人群</label>
                      <textarea value={editedSummary.target_audience}
                        onChange={e=>setEditedSummary({...editedSummary,target_audience:e.target.value})} rows={1}/>
                    </div>
                  </div>
                )}
                {transcript && (
                  <div className="result-block">
                    <div className="result-header">
                      <h3>📝 转录文本</h3>
                      <div className="header-right">
                        {enhance?.translation && (
                          <div className="lang-toggle">
                            <button className={`lang-btn ${!showTranslation?'active':''}`} onClick={()=>setShowTranslation(false)}>原文</button>
                            <button className={`lang-btn ${showTranslation?'active':''}`} onClick={()=>setShowTranslation(true)}>中文翻译</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {enhance && (
                      <div className="lang-badge">
                        {enhance.language==='zh'?'🇨🇳 中文':enhance.language==='en'?'🇺🇸 English':enhance.language==='ja'?'🇯🇵 日本語':`🌐 ${enhance.language.toUpperCase()}`}
                        <span className="lang-tip">· 双击单词可查词</span>
                      </div>
                    )}
                    {showTranslation && enhance?.translation
                      ? <div className="transcript-text translation-text">{enhance.translation}</div>
                      : <div className="transcript-text" onDoubleClick={e=>{
                            const sel=window.getSelection()?.toString().trim()
                            if(sel&&sel.length<30) lookupWord(sel)
                          }}
                          dangerouslySetInnerHTML={{__html:enhance?.keywords?.length
                            ?highlightKeywords(transcript,enhance.keywords)
                            :transcript.replace(/\n/g,'<br/>')}}
                        />
                    }
                  </div>
                )}
              </div>
          }
        </main>
      </div>

      {searchOpen && renderSearchModal()}
    </div>
  )
}
