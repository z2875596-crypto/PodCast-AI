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
// CET-6 题库
interface Cet6Item {
  id: string
  title: string           // 如 "2023年12月第1套"
  year: string            // "2023"
  month: string           // "12"
  set: string             // "1"
  type: 'official'|'custom' // 内置真题 or 用户上传
  sections: Cet6Section[]
  addedAt: string
}
interface Cet6Section {
  id: string
  name: string            // "短对话" | "长对话" | "听力篇章"
  audioName: string       // 文件名（用于显示）
  audioDataUrl?: string   // base64，用于自定义题目
  transcript: string      // 听力原文
}

type Stage = 'idle'|'downloading'|'transcribing'|'summarizing'|'enhancing'|'archiving'|'done'
type Page = 'cover'|'main'|'listen'|'cet6'|'cet6-practice'|'cet6-exam'
type LeftTab = 'input'|'history'|'vocab'
type Cet6Tab = 'library'|'upload'

const API = '/api/v1'
const HISTORY_KEY = 'podcast_ai_history'
const VOCAB_KEY   = 'podcast_ai_vocab'
const CET6_KEY    = 'podcast_ai_cet6'

// 内置示例真题（无音频，仅文本示例）
const BUILTIN_CET6: Cet6Item[] = [
  {
    id: 'official-2023-12-1',
    title: '2023年12月 第1套',
    year: '2023', month: '12', set: '1',
    type: 'official',
    addedAt: '2024-01-01',
    sections: [
      {
        id: 's1', name: '短对话',
        audioName: '2023-12月-第1套-短对话.mp3',
        transcript: `[00:00] Woman: I heard you're going to transfer to another department. Is that true?
[00:05] Man: Yes, I've been offered a position in the marketing department, and I think it's a great opportunity for career development.
[00:12] Woman: That sounds exciting! When will you start?
[00:15] Man: Next Monday. I'm a bit nervous but also looking forward to new challenges.
[00:20] Woman: I'm sure you'll do great. The marketing team is lucky to have you.
[00:25] Man: Thanks for your encouragement. I'll miss working with you though.`
      },
      {
        id: 's2', name: '长对话',
        audioName: '2023-12月-第1套-长对话.mp3',
        transcript: `[00:00] Interviewer: Today we're talking with Dr. Sarah Chen about her research on renewable energy. Dr. Chen, can you tell us about your latest findings?
[00:10] Dr. Chen: Certainly. Our team has been studying solar panel efficiency for the past three years. We've developed a new coating material that increases energy conversion by 23%.
[00:22] Interviewer: That's remarkable. How does this compare to current technology?
[00:26] Dr. Chen: Current commercial panels operate at about 20% efficiency. Our new material could push that to nearly 25%, which would be a significant breakthrough.
[00:37] Interviewer: What are the main challenges in bringing this to market?
[00:41] Dr. Chen: Cost is the biggest hurdle. The materials are expensive to produce at scale. We're working with manufacturers to find more cost-effective production methods.`
      },
      {
        id: 's3', name: '听力篇章',
        audioName: '2023-12月-第1套-听力篇章.mp3',
        transcript: `[00:00] The concept of smart cities has been gaining momentum worldwide as urban populations continue to grow. A smart city uses digital technology and data analytics to improve the quality of life for its residents.
[00:15] Transportation is one of the key areas where smart city technology is making a difference. Intelligent traffic management systems can reduce congestion by up to 30%, while smart public transit apps help commuters plan their journeys more efficiently.
[00:30] Energy management is another crucial component. Smart grids allow for more efficient distribution of electricity, reducing waste and lowering costs for both utilities and consumers.
[00:45] However, the development of smart cities also raises important questions about privacy and data security. As cities collect more data about their residents' behavior and movements, ensuring that this information is protected becomes increasingly important.`
      }
    ]
  },
  {
    id: 'official-2023-06-1',
    title: '2023年6月 第1套',
    year: '2023', month: '06', set: '1',
    type: 'official',
    addedAt: '2024-01-01',
    sections: [
      {
        id: 's1', name: '短对话',
        audioName: '2023-6月-第1套-短对话.mp3',
        transcript: `[00:00] Man: Professor, I'm struggling with the research paper. I can't seem to find enough sources on my topic.
[00:06] Professor: What topic did you choose?
[00:08] Man: The impact of social media on mental health in teenagers.
[00:11] Professor: That's actually a very well-researched area. Have you tried the university database? There are hundreds of peer-reviewed articles on that subject.
[00:19] Man: I only used Google Scholar. I didn't know about the university database.
[00:24] Professor: Come to my office hours tomorrow and I'll show you how to access it. You'll find much better sources there.`
      },
      {
        id: 's2', name: '长对话',
        audioName: '2023-6月-第1套-长对话.mp3',
        transcript: `[00:00] Host: Welcome back to Career Conversations. Today's guest is Michael Torres, a successful entrepreneur who started his company right out of college. Michael, tell us your story.
[00:12] Michael: Thanks for having me. I graduated with a computer science degree but couldn't find a job that excited me, so I decided to create my own opportunity.
[00:22] Host: That's a bold move. What was your first product?
[00:25] Michael: An app that helps small businesses manage their inventory. I noticed that many local shops were still using spreadsheets and losing track of stock.
[00:35] Host: How did you fund it initially?
[00:37] Michael: I saved up six months of living expenses, moved back with my parents, and used my savings to build the MVP. It was tough but necessary.`
      },
      {
        id: 's3', name: '听力篇章',
        audioName: '2023-6月-第1套-听力篇章.mp3',
        transcript: `[00:00] Artificial intelligence is transforming the healthcare industry in ways that were unimaginable just a decade ago. From diagnosing diseases to developing new drugs, AI is becoming an essential tool for medical professionals.
[00:15] One of the most promising applications is in medical imaging. AI algorithms can now analyze X-rays, MRI scans, and CT scans with accuracy that rivals experienced radiologists. In some studies, AI has even outperformed doctors in detecting certain types of cancer.
[00:32] Drug discovery is another area where AI is making significant contributions. Traditional drug development can take over a decade and cost billions of dollars. AI can analyze millions of molecular combinations in days, dramatically speeding up the process.
[00:48] Despite these advances, experts emphasize that AI is not meant to replace doctors but to assist them. The goal is to free up medical professionals from routine tasks so they can focus on patient care and complex decision-making.`
      }
    ]
  }
]

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
//  精听页面组件（复用于主流程和CET6）
// ══════════════════════════════════════════════════════════════
function ListenPage({
  audioFile, audioUrl, audioDataUrl, transcript, onBack, onLookup
}: {
  audioFile?: File|null
  audioUrl?: string
  audioDataUrl?: string
  transcript: string
  onBack: () => void
  onLookup: (word: string) => void
}) {
  const [segments, setSegments]     = useState<Segment[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [activeId, setActiveId]     = useState<number|null>(null)
  const [loopId, setLoopId]         = useState<number|null>(null)
  const [showTrans, setShowTrans]   = useState<Record<number,boolean>>({})
  const [showAllTrans, setShowAllTrans] = useState(false)
  const [speed, setSpeed]           = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const segRefs  = useRef<Record<number, HTMLDivElement|null>>({})
  const objUrl   = useRef('')

  useEffect(() => {
    if (audioFile) { objUrl.current = URL.createObjectURL(audioFile) }
    return () => { if (objUrl.current) URL.revokeObjectURL(objUrl.current) }
  }, [audioFile])

  const src = audioFile ? objUrl.current : (audioDataUrl || audioUrl || '')

  useEffect(() => {
    if (!transcript) return
    setLoading(true); setError('')
    fetch(`${API}/segments`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: transcript }),
    })
      .then(r=>r.json())
      .then(d=>{ setSegments(d.segments||[]); setLoading(false) })
      .catch(()=>{ setError('切割失败，请重试'); setLoading(false) })
  }, [transcript])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !segments.length) return
    function onTime() {
      const t = audio!.currentTime
      const cur = [...segments].reverse().find(s => s.start <= t)
      if (cur) { setActiveId(cur.id); segRefs.current[cur.id]?.scrollIntoView({behavior:'smooth',block:'nearest'}) }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [segments])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || loopId===null) return
    const seg  = segments.find(s=>s.id===loopId)
    if (!seg) return
    const next = segments.find(s=>s.id>loopId)
    function onTime() {
      const end = next ? next.start : audio!.duration
      if (audio!.currentTime >= end) { audio!.currentTime = seg!.start; audio!.play() }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [loopId, segments])

  function playSeg(seg: Segment) {
    const audio = audioRef.current; if (!audio) return
    audio.currentTime = seg.start; audio.playbackRate = speed; audio.play()
    setActiveId(seg.id)
  }

  return (
    <div className="listen-page">
      <nav className="topbar">
        <button className="btn-back" onClick={onBack}>← 返回</button>
        <div className="topbar-logo"><span className="topbar-icon">◎</span><span>精听练习</span></div>
        <div className="topbar-right">
          <button className={`btn-trans-toggle ${showAllTrans?'active':''}`}
            onClick={()=>setShowAllTrans(v=>!v)}>
            {showAllTrans?'隐藏翻译':'显示全部翻译'}
          </button>
        </div>
      </nav>
      <div className="listen-layout">
        <div className="listen-left">
          {loading && <div className="listen-loading"><div className="dots"><span/><span/><span/></div><p>正在切割句子…</p></div>}
          {error && <div className="error-msg">⚠ {error}</div>}
          {!loading && segments.length>0 && (
            <div className="seg-list">
              {segments.map(seg=>(
                <div key={seg.id} ref={el=>segRefs.current[seg.id]=el}
                  className={`seg-item ${activeId===seg.id?'active':''} ${loopId===seg.id?'looping':''}`}
                  onClick={()=>playSeg(seg)}>
                  <div className="seg-top">
                    <span className="seg-time">{fmtTime(seg.start)}</span>
                    <span className="seg-diff" style={{color:diffColor(seg.difficulty)}}>{diffLabel(seg.difficulty)}</span>
                    <div className="seg-actions" onClick={e=>e.stopPropagation()}>
                      <button className={`seg-btn ${loopId===seg.id?'active':''}`} title="单句循环"
                        onClick={()=>setLoopId(p=>p===seg.id?null:seg.id)}>🔁</button>
                      <button className="seg-btn" title="查词"
                        onClick={()=>{const s=window.getSelection()?.toString().trim();if(s)onLookup(s)}}>🔍</button>
                      <button className={`seg-btn ${(showTrans[seg.id]||showAllTrans)?'active':''}`}
                        onClick={()=>setShowTrans(p=>({...p,[seg.id]:!p[seg.id]}))}>译</button>
                    </div>
                  </div>
                  <p className="seg-text">{seg.text}</p>
                  {(showTrans[seg.id]||showAllTrans) && <p className="seg-trans">{seg.translation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="listen-right">
          <div className="player-card">
            <div className="player-title">
              {loopId!==null ? <><span className="loop-badge">🔁 循环中</span>第 {loopId} 句</>
               : activeId!==null ? `第 ${activeId} 句` : '点击句子开始播放'}
            </div>
            {activeId!==null && segments.find(s=>s.id===activeId) && (
              <div className="player-seg-display">
                <p className="player-seg-text">{segments.find(s=>s.id===activeId)?.text}</p>
                <p className="player-seg-trans">{segments.find(s=>s.id===activeId)?.translation}</p>
              </div>
            )}
            {src
              ? <audio ref={audioRef} src={src} controls className="audio-player"
                  onPlay={e=>{(e.target as HTMLAudioElement).playbackRate=speed}}/>
              : <div className="no-audio"><p>⚠ 无音频文件</p><p>请上传MP3文件后使用精听功能</p></div>
            }
            <div className="speed-control">
              <span className="speed-label">播放速度</span>
              <div className="speed-btns">
                {[0.5,0.75,1,1.25,1.5].map(s=>(
                  <button key={s} className={`speed-btn ${speed===s?'active':''}`}
                    onClick={()=>{setSpeed(s);if(audioRef.current)audioRef.current.playbackRate=s}}>{s}x</button>
                ))}
              </div>
            </div>
            {segments.length>0 && (
              <div className="listen-stats">
                {[
                  {label:'句子',num:segments.length,color:'var(--text)'},
                  {label:'简单',num:segments.filter(s=>s.difficulty==='easy').length,color:'#16a34a'},
                  {label:'中等',num:segments.filter(s=>s.difficulty==='medium').length,color:'#d97706'},
                  {label:'困难',num:segments.filter(s=>s.difficulty==='hard').length,color:'#dc2626'},
                ].map(s=>(
                  <div key={s.label} className="stat-item">
                    <span className="stat-num" style={{color:s.color}}>{s.num}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  CET-6 模拟考试组件
// ══════════════════════════════════════════════════════════════
function ExamPage({
  item, section, onBack
}: {
  item: Cet6Item
  section: Cet6Section
  onBack: () => void
}) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [speed, setSpeed]                   = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  const src = section.audioDataUrl || ''

  return (
    <div className="listen-page">
      <nav className="topbar">
        <button className="btn-back" onClick={onBack}>← 返回</button>
        <div className="topbar-logo">
          <span className="topbar-icon">◎</span>
          <span>{item.title} · {section.name}</span>
        </div>
        <div className="topbar-right">
          <button className={`btn-trans-toggle ${showTranscript?'active':''}`}
            onClick={()=>setShowTranscript(v=>!v)}>
            {showTranscript ? '隐藏原文' : '显示听力原文'}
          </button>
        </div>
      </nav>

      <div className="exam-layout">
        {/* 播放器区域 */}
        <div className="exam-player-area">
          <div className="exam-player-card">
            <div className="exam-section-badge">{section.name}</div>
            <h2 className="exam-title">{item.title}</h2>
            <p className="exam-filename">🎵 {section.audioName}</p>

            {src
              ? <audio ref={audioRef} src={src} controls className="audio-player exam-audio"
                  onPlay={e=>{(e.target as HTMLAudioElement).playbackRate=speed}}/>
              : <div className="no-audio">
                  <p>⚠ 暂无音频文件</p>
                  <p>内置示例真题不含音频，请上传自定义题目</p>
                </div>
            }

            <div className="speed-control">
              <span className="speed-label">播放速度</span>
              <div className="speed-btns">
                {[0.75,1,1.25].map(s=>(
                  <button key={s} className={`speed-btn ${speed===s?'active':''}`}
                    onClick={()=>{setSpeed(s);if(audioRef.current)audioRef.current.playbackRate=s}}>{s}x</button>
                ))}
              </div>
            </div>

            <div className="exam-tip">
              💡 建议先完整听一遍，再点击「显示听力原文」对照
            </div>
          </div>
        </div>

        {/* 听力原文 */}
        {showTranscript && (
          <div className="exam-transcript-area">
            <div className="exam-transcript-header">
              <h3>📄 听力原文</h3>
            </div>
            <div className="exam-transcript-text">
              {section.transcript.split('\n').map((line, i) => (
                <p key={i} className={line.match(/^\[\d+:\d+\]/) ? 'transcript-line timed' : 'transcript-line'}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  CET-6 训练中心
// ══════════════════════════════════════════════════════════════
function Cet6Center({
  onBack, onListen, onExam
}: {
  onBack: () => void
  onListen: (item: Cet6Item, section: Cet6Section) => void
  onExam:   (item: Cet6Item, section: Cet6Section) => void
}) {
  const [tab, setTab]           = useState<Cet6Tab>('library')
  const [customItems, setCustomItems] = useState<Cet6Item[]>(() => loadLS(CET6_KEY))
  const [filterYear, setFilterYear]   = useState('all')
  const [filterType, setFilterType]   = useState('all')
  const [expanded, setExpanded]       = useState<string|null>(null)

  // 上传表单状态
  const [upTitle, setUpTitle]   = useState('')
  const [upYear, setUpYear]     = useState('2024')
  const [upMonth, setUpMonth]   = useState('06')
  const [upSet, setUpSet]       = useState('1')
  const [upSections, setUpSections] = useState<{name:string;file:File|null;transcript:string}[]>([
    {name:'短对话',file:null,transcript:''},
    {name:'长对话',file:null,transcript:''},
    {name:'听力篇章',file:null,transcript:''},
  ])
  const [upLoading, setUpLoading] = useState(false)
  const [upError, setUpError]   = useState('')
  const [upSuccess, setUpSuccess] = useState(false)

  const allItems = [...BUILTIN_CET6, ...customItems]
  const years    = ['all', ...Array.from(new Set(allItems.map(i=>i.year))).sort().reverse()]

  const filtered = allItems.filter(i => {
    if (filterYear !== 'all' && i.year !== filterYear) return false
    if (filterType !== 'all' && i.type !== filterType) return false
    return true
  })

  function updateSection(idx: number, field: string, val: any) {
    setUpSections(prev => prev.map((s,i) => i===idx ? {...s,[field]:val} : s))
  }

  async function handleUpload() {
    if (!upTitle.trim()) { setUpError('请填写套题名称'); return }
    const hasContent = upSections.some(s => s.transcript.trim())
    if (!hasContent) { setUpError('请至少填写一个部分的听力原文'); return }

    setUpLoading(true); setUpError('')
    try {
      const sections: Cet6Section[] = await Promise.all(
        upSections.filter(s => s.transcript.trim()).map(async (s, i) => {
          let audioDataUrl: string|undefined
          if (s.file) {
            audioDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(s.file!)
            })
          }
          return {
            id: `s${i+1}-${Date.now()}`,
            name: s.name,
            audioName: s.file?.name || `${s.name}.mp3`,
            audioDataUrl,
            transcript: s.transcript,
          }
        })
      )

      const newItem: Cet6Item = {
        id: `custom-${Date.now()}`,
        title: upTitle.trim(),
        year: upYear, month: upMonth, set: upSet,
        type: 'custom',
        sections,
        addedAt: new Date().toLocaleString('zh-CN'),
      }

      const updated = [newItem, ...customItems]
      setCustomItems(updated)
      saveLS(CET6_KEY, updated)
      setUpSuccess(true)
      setTimeout(() => { setUpSuccess(false); setTab('library') }, 1500)
    } catch(e) {
      setUpError('上传失败，请重试')
    } finally {
      setUpLoading(false)
    }
  }

  function deleteCustom(id: string) {
    const updated = customItems.filter(i=>i.id!==id)
    setCustomItems(updated); saveLS(CET6_KEY, updated)
  }

  return (
    <div className="cet6-page">
      <nav className="topbar">
        <button className="btn-back" onClick={onBack}>← 返回</button>
        <div className="topbar-logo">
          <span className="topbar-icon">◎</span>
          <span>CET-6 训练中心</span>
        </div>
        <div className="topbar-right">
          <span className="cet6-count">{allItems.length} 套题</span>
        </div>
      </nav>

      <div className="cet6-layout">
        {/* 左侧导航 */}
        <aside className="cet6-sidebar">
          <button className={`cet6-nav-btn ${tab==='library'?'active':''}`}
            onClick={()=>setTab('library')}>
            📚 题库
          </button>
          <button className={`cet6-nav-btn ${tab==='upload'?'active':''}`}
            onClick={()=>setTab('upload')}>
            ➕ 上传题目
          </button>

          {tab==='library' && (
            <div className="cet6-filters">
              <div className="filter-group">
                <label>年份</label>
                <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="filter-select">
                  {years.map(y=><option key={y} value={y}>{y==='all'?'全部':y+'年'}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>类型</label>
                <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="filter-select">
                  <option value="all">全部</option>
                  <option value="official">内置真题</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
            </div>
          )}
        </aside>

        {/* 右侧内容 */}
        <main className="cet6-main">
          {/* 题库列表 */}
          {tab==='library' && (
            <div className="cet6-list">
              {filtered.length===0 && (
                <div className="cet6-empty">
                  <span>📭</span><p>没有找到匹配的题目</p>
                </div>
              )}
              {filtered.map(item=>(
                <div key={item.id} className="cet6-item">
                  <div className="cet6-item-header" onClick={()=>setExpanded(expanded===item.id?null:item.id)}>
                    <div className="cet6-item-info">
                      <span className={`cet6-type-badge ${item.type}`}>
                        {item.type==='official'?'内置真题':'自定义'}
                      </span>
                      <h3 className="cet6-item-title">{item.title}</h3>
                      <span className="cet6-item-meta">{item.sections.length} 个部分</span>
                    </div>
                    <div className="cet6-item-actions">
                      {item.type==='custom' && (
                        <button className="btn-delete-item"
                          onClick={e=>{e.stopPropagation();deleteCustom(item.id)}}>删除</button>
                      )}
                      <span className="cet6-chevron">{expanded===item.id?'▲':'▼'}</span>
                    </div>
                  </div>

                  {expanded===item.id && (
                    <div className="cet6-sections">
                      {item.sections.map(sec=>(
                        <div key={sec.id} className="cet6-section-row">
                          <div className="cet6-section-info">
                            <span className="cet6-section-name">{sec.name}</span>
                            <span className="cet6-section-file">🎵 {sec.audioName}</span>
                          </div>
                          <div className="cet6-section-btns">
                            <button className="btn-cet6-action listen"
                              onClick={()=>onListen(item, sec)}>
                              🎧 精听练习
                            </button>
                            <button className="btn-cet6-action exam"
                              onClick={()=>onExam(item, sec)}>
                              📋 模拟考试
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 上传区域 */}
          {tab==='upload' && (
            <div className="cet6-upload">
              <div className="upload-card">
                <h2 className="upload-title">上传自定义题目</h2>
                <p className="upload-desc">上传音频和听力原文，保存到本地题库永久使用</p>

                <div className="upload-form">
                  <div className="upload-field">
                    <label>套题名称 *</label>
                    <input type="text" placeholder="如：2024年12月第2套" value={upTitle}
                      onChange={e=>setUpTitle(e.target.value)} className="url-input"/>
                  </div>

                  <div className="upload-field-row">
                    <div className="upload-field">
                      <label>年份</label>
                      <select value={upYear} onChange={e=>setUpYear(e.target.value)} className="filter-select">
                        {['2024','2023','2022','2021','2020'].map(y=><option key={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="upload-field">
                      <label>月份</label>
                      <select value={upMonth} onChange={e=>setUpMonth(e.target.value)} className="filter-select">
                        <option value="06">6月</option>
                        <option value="12">12月</option>
                      </select>
                    </div>
                    <div className="upload-field">
                      <label>套次</label>
                      <select value={upSet} onChange={e=>setUpSet(e.target.value)} className="filter-select">
                        <option value="1">第1套</option>
                        <option value="2">第2套</option>
                        <option value="3">第3套</option>
                      </select>
                    </div>
                  </div>

                  <div className="upload-sections">
                    <label className="upload-sections-label">听力部分</label>
                    {upSections.map((sec, idx)=>(
                      <div key={idx} className="upload-section-block">
                        <div className="upload-section-header">
                          <span className="upload-section-name">{sec.name}</span>
                        </div>
                        <div className="upload-section-body">
                          <UploadFileZone
                            label={`上传 ${sec.name} MP3`}
                            file={sec.file}
                            onChange={f=>updateSection(idx,'file',f)}
                          />
                          <div className="upload-field">
                            <label>听力原文（带时间戳更佳）</label>
                            <textarea
                              placeholder={`[00:00] 听力原文内容...\n[00:30] 继续...`}
                              value={sec.transcript}
                              onChange={e=>updateSection(idx,'transcript',e.target.value)}
                              rows={5}
                              className="upload-textarea"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {upError && <div className="error-msg">⚠ {upError}</div>}
                  {upSuccess && <div className="success-msg">✓ 上传成功！正在跳转到题库…</div>}

                  <button className="btn-upload-submit" onClick={handleUpload} disabled={upLoading}>
                    {upLoading ? <><span className="spinner-sm"/>保存中…</> : '保存到题库 →'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// 文件上传子组件
function UploadFileZone({ label, file, onChange }: {
  label: string; file: File|null; onChange: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="file-zone upload-file-zone" onClick={()=>ref.current?.click()}>
      {file
        ? <><div className="file-emoji">🎵</div><span className="file-name">{file.name}</span></>
        : <><div className="upload-arrow">↑</div><span>{label}</span></>
      }
      <input ref={ref} type="file" accept=".mp3,.m4a,.wav,.ogg"
        style={{display:'none'}} onChange={e=>{ if(e.target.files?.[0]) onChange(e.target.files[0]) }}/>
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

  // CET-6 状态
  const [cet6Item, setCet6Item]       = useState<Cet6Item|null>(null)
  const [cet6Section, setCet6Section] = useState<Cet6Section|null>(null)

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
      if ((e.metaKey||e.ctrlKey)&&e.key==='k') { e.preventDefault(); setSearchOpen(o=>!o) }
      if (e.key==='Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (searchOpen) setTimeout(()=>searchRef.current?.focus(),50) }, [searchOpen])

  useEffect(() => {
    if (summary && transcript) {
      const existing = loadLS<HistoryItem>(HISTORY_KEY)
      if (existing[0]?.transcript===transcript) return
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
    if (docUrl&&history.length>0) {
      const updated = history.map((h,i)=>i===0?{...h,docUrl}:h)
      setHistory(updated); saveLS(HISTORY_KEY, updated)
    }
  }, [docUrl])

  const lookupWord = useCallback(async (word: string) => {
    if (!word.trim()) return
    setSearchWord(word.trim()); setSearchOpen(true)
    setSearchLoading(true); setSearchError(''); setSearchResult(null)
    try {
      const res = await fetch(`${API}/word`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({word:word.trim()}),
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
    const updated=vocab.filter(v=>v.id!==id); setVocab(updated); saveLS(VOCAB_KEY,updated)
  }
  function isInVocab(word:string) { return vocab.some(v=>v.word.toLowerCase()===word.toLowerCase()) }

  function loadFromHistory(item: HistoryItem) {
    setTranscript(item.transcript); setSummary(item.summary)
    setEditedSummary(item.summary); setEnhance(item.enhance||null)
    setDocUrl(item.docUrl||''); setDocTitle('')
    setStage(item.docUrl?'done':'idle'); setError(''); setLeftTab('input')
    setPage('main')
  }
  function deleteHistory(id:string,e:React.MouseEvent) {
    e.stopPropagation()
    const updated=history.filter(h=>h.id!==id); setHistory(updated); saveLS(HISTORY_KEY,updated)
  }

  async function run() {
    setError(''); setTranscript(''); setSummary(null); setEditedSummary(null)
    setEnhance(null); setDocUrl(''); setShowTranslation(false)
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
        const form=new FormData(); form.append('file',file)
        res = await fetch(`${API}/audio/upload`,{method:'POST',body:form})
      }
      let data=await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'音频处理失败')

      setStage('transcribing')
      res=await fetch(`${API}/transcribe`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({path:data.path}),
      })
      data=await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'转录失败')
      const txt=data.text; setTranscript(txt)

      setStage('summarizing')
      res=await fetch(`${API}/summarize`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text:txt}),
      })
      data=await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'摘要失败')
      setSummary(data); setEditedSummary(data)

      setStage('enhancing')
      res=await fetch(`${API}/enhance`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text:txt}),
      })
      data=await res.json()
      if (res.ok) setEnhance(data)

      setStage('idle')
    } catch(e:any) { setError(e.message); setStage('idle') }
  }

  async function handleArchive() {
    setError(''); setStage('archiving')
    try {
      const res=await fetch(`${API}/feishu/create-doc`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({title:docTitle||editedSummary?.core_topic||'播客摘要',transcript,summary:editedSummary}),
      })
      const data=await res.json()
      if (!res.ok) throw new Error(data.detail?.message||'创建文档失败')
      setDocUrl(data.doc_url); setStage('done')
    } catch(e:any) { setError(e.message); setStage('idle') }
  }

  function updateKeyPoint(i:number,val:string) {
    if (!editedSummary) return
    const kp=[...editedSummary.key_points]; kp[i]=val
    setEditedSummary({...editedSummary,key_points:kp})
  }

  const hasResult=!!(transcript||summary)

  function renderSearchModal() {
    return (
      <div className="search-overlay" onClick={()=>setSearchOpen(false)}>
        <div className="search-modal" onClick={e=>e.stopPropagation()}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input ref={searchRef} type="text" placeholder="输入英文单词查询… (Esc 关闭)"
              value={searchWord} onChange={e=>setSearchWord(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')lookupWord(searchWord);if(e.key==='Escape')setSearchOpen(false)}}
              className="search-input"/>
            {searchWord&&<button className="search-go" onClick={()=>lookupWord(searchWord)}>查询</button>}
            <button className="search-close" onClick={()=>setSearchOpen(false)}>×</button>
          </div>
          <div className="search-body">
            {searchLoading&&<div className="search-loading"><div className="dots"><span/><span/><span/></div><p>查询中…</p></div>}
            {searchError&&<div className="error-msg">⚠ {searchError}</div>}
            {searchResult&&!searchLoading&&(
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
            {!searchLoading&&!searchResult&&!searchError&&(
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

  // ── 路由 ────────────────────────────────────────────────────
  if (page==='cover') return (
    <div className="cover" onClick={()=>setPage('main')}>
      <div className="cover-bg"/>
      <div className="cover-content">
        <div className="cover-logo">
          <span className="cover-icon">◎</span>
          <h1 className="cover-title">PodCast<em>AI</em></h1>
        </div>
        <p className="cover-sub">播客转录 · 英语精听 · CET-6 训练</p>
        <div className="cover-hint">点击任意位置开始 →</div>
      </div>
      <div className="cover-circles">
        <div className="circle c1"/><div className="circle c2"/><div className="circle c3"/>
      </div>
    </div>
  )

  if (page==='listen') return (
    <>
      <ListenPage
        audioFile={inputMode==='file'?file:null}
        audioUrl={inputMode==='url'?url:''}
        transcript={transcript}
        onBack={()=>setPage('main')}
        onLookup={lookupWord}
      />
      {searchOpen&&renderSearchModal()}
    </>
  )

  if (page==='cet6') return (
    <Cet6Center
      onBack={()=>setPage('main')}
      onListen={(item,sec)=>{ setCet6Item(item); setCet6Section(sec); setPage('cet6-practice') }}
      onExam={(item,sec)=>{ setCet6Item(item); setCet6Section(sec); setPage('cet6-exam') }}
    />
  )

  if (page==='cet6-practice' && cet6Item && cet6Section) return (
    <>
      <ListenPage
        audioDataUrl={cet6Section.audioDataUrl}
        transcript={cet6Section.transcript}
        onBack={()=>setPage('cet6')}
        onLookup={lookupWord}
      />
      {searchOpen&&renderSearchModal()}
    </>
  )

  if (page==='cet6-exam' && cet6Item && cet6Section) return (
    <ExamPage
      item={cet6Item}
      section={cet6Section}
      onBack={()=>setPage('cet6')}
    />
  )

  // ── 主页面 ──────────────────────────────────────────────────
  return (
    <div className="main-app">
      <nav className="topbar">
        <div className="topbar-logo" onClick={()=>setPage('cover')}>
          <span className="topbar-icon">◎</span>
          <span>PodCast<em>AI</em></span>
        </div>
        <div className="topbar-right">
          <button className="btn-cet6-entry" onClick={()=>setPage('cet6')}>📚 CET-6 训练</button>
          {transcript&&(
            <button className="btn-listen" onClick={()=>setPage('listen')}>🎧 精听模式</button>
          )}
          <button className="btn-search-trigger" onClick={()=>setSearchOpen(true)}>🔍 查词 <kbd>⌘K</kbd></button>
          {hasResult&&(
            <button className="btn-new" onClick={()=>{
              setTranscript(''); setSummary(null); setEditedSummary(null)
              setEnhance(null); setDocUrl(''); setUrl(''); setFile(null)
              setError(''); setStage('idle'); setLeftTab('input')
            }}>+ 新建</button>
          )}
        </div>
      </nav>

      <div className="workspace">
        <aside className="left-panel">
          <div className="left-tabs">
            <button className={`left-tab ${leftTab==='input'?'active':''}`} onClick={()=>setLeftTab('input')}>处理</button>
            <button className={`left-tab ${leftTab==='vocab'?'active':''}`} onClick={()=>setLeftTab('vocab')}>
              生词本{vocab.length>0&&<span className="history-badge">{vocab.length}</span>}
            </button>
            <button className={`left-tab ${leftTab==='history'?'active':''}`} onClick={()=>setLeftTab('history')}>
              历史{history.length>0&&<span className="history-badge">{history.length}</span>}
            </button>
          </div>

          {leftTab==='input'&&<>
            <div className="panel-section">
              <h2 className="section-title">音频来源</h2>
              <div className="tab-row">
                <button className={`tab ${inputMode==='url'?'active':''}`} onClick={()=>setInputMode('url')}>🔗 URL</button>
                <button className={`tab ${inputMode==='file'?'active':''}`} onClick={()=>setInputMode('file')}>📁 上传文件</button>
              </div>
              {inputMode==='url'
                ?<input type="url" placeholder="粘贴播客链接…" value={url}
                    onChange={e=>setUrl(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!loading&&run()}
                    className="url-input"/>
                :<div className="file-zone" onClick={()=>fileRef.current?.click()}>
                  {file
                    ?<><div className="file-emoji">🎵</div><span className="file-name">{file.name}</span></>
                    :<><div className="upload-arrow">↑</div><span>点击选择音频文件</span><span className="file-hint">MP3 · M4A · WAV · OGG</span></>}
                  <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                    style={{display:'none'}} onChange={e=>setFile(e.target.files?.[0]||null)}/>
                </div>
              }
              {error&&<div className="error-msg">⚠ {error}</div>}
              {loading
                ?<div className="loading-state"><div className="dots"><span/><span/><span/></div><p>{stageLabel[stage]}</p></div>
                :<button className="btn-process" onClick={run} disabled={inputMode==='url'?!url.trim():!file}>
                  {hasResult?'重新处理':'开始处理'}
                </button>
              }
              {transcript&&!loading&&(
                <button className="btn-listen-side" onClick={()=>setPage('listen')}>🎧 进入精听模式 →</button>
              )}
            </div>

            {(loading||hasResult)&&(
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

            {enhance?.keywords.length&&(
              <div className="panel-section">
                <h2 className="section-title">关键词</h2>
                <div className="keywords-cloud">
                  {enhance.keywords.map((kw,i)=>(
                    <span key={i} className="keyword-tag" onClick={()=>lookupWord(kw)}>{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {summary&&stage!=='archiving'&&(
              <div className="panel-section archive-section">
                <h2 className="section-title">存档到飞书</h2>
                {stage==='done'
                  ?<div className="done-state">
                      <span className="done-check">✓</span>
                      <div><p>文档创建成功！</p><a href={docUrl} target="_blank" rel="noreferrer">打开飞书文档 ↗</a></div>
                    </div>
                  :<>
                      <input type="text" placeholder="文档标题（可选）" value={docTitle}
                        onChange={e=>setDocTitle(e.target.value)} className="url-input"/>
                      <button className="btn-archive" onClick={handleArchive} disabled={loading}>保存到飞书 →</button>
                    </>
                }
              </div>
            )}
          </>}

          {leftTab==='vocab'&&(
            <div className="history-panel">
              {vocab.length===0
                ?<div className="history-empty"><span>📖</span><p>生词本是空的</p><p>在查词窗口点「加入生词本」</p></div>
                :<>
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

          {leftTab==='history'&&(
            <div className="history-panel">
              {history.length===0
                ?<div className="history-empty"><span>🕐</span><p>暂无历史记录</p><p>处理完成后会自动保存</p></div>
                :<>
                  <div className="history-header">
                    <span>{history.length} 条记录</span>
                    <button className="btn-clear" onClick={()=>{setHistory([]);saveLS(HISTORY_KEY,[])}}>清空</button>
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
                          {item.docUrl&&<span className="history-tag">已存飞书</span>}
                          {item.enhance?.translation&&<span className="history-tag-trans">含翻译</span>}
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
            ?<div className="empty-state">
              <div className="empty-icon">🎙</div>
              <h3>上传音频开始处理</h3>
              <p>转录文本和摘要结果会显示在这里</p>
              <button className="btn-cet6-banner" onClick={()=>setPage('cet6')}>
                <span>📚</span>
                <div><strong>CET-6 训练中心</strong><span>内置真题 · 精听练习 · 模拟考试</span></div>
                <span>→</span>
              </button>
              <button className="btn-search-trigger mt" onClick={()=>setSearchOpen(true)}>🔍 或直接查词 ⌘K</button>
              {history.length>0&&(
                <button className="btn-history-hint" onClick={()=>setLeftTab('history')}>
                  查看 {history.length} 条历史记录 →
                </button>
              )}
            </div>
            :<div className="results">
              {editedSummary&&(
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
              {transcript&&(
                <div className="result-block">
                  <div className="result-header">
                    <h3>📝 转录文本</h3>
                    <div className="header-right">
                      {enhance?.translation&&(
                        <div className="lang-toggle">
                          <button className={`lang-btn ${!showTranslation?'active':''}`} onClick={()=>setShowTranslation(false)}>原文</button>
                          <button className={`lang-btn ${showTranslation?'active':''}`} onClick={()=>setShowTranslation(true)}>中文翻译</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {enhance&&(
                    <div className="lang-badge">
                      {enhance.language==='zh'?'🇨🇳 中文':enhance.language==='en'?'🇺🇸 English':enhance.language==='ja'?'🇯🇵 日本語':`🌐 ${enhance.language.toUpperCase()}`}
                      <span className="lang-tip">· 双击单词可查词</span>
                    </div>
                  )}
                  {showTranslation&&enhance?.translation
                    ?<div className="transcript-text translation-text">{enhance.translation}</div>
                    :<div className="transcript-text" onDoubleClick={e=>{
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

      {searchOpen&&renderSearchModal()}
    </div>
  )
}
