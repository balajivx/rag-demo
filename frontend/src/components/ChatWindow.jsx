import { useState, useRef, useEffect } from 'react'
import './ChatWindow.css'

const WELCOME_TEXT = "Neural Knowledge Matrix initialized. Upload documents, images, audio, or video files in the side panel to vectorize and query multi-modal intelligence."

const QUICK_PROMPTS = [
  "⚡ Generate an executive summary of all uploaded files",
  "📊 Extract key metrics, dates, and quantitative findings",
  "🔍 Cross-reference contradictions or overlaps across sources",
  "💡 What are the top 5 strategic takeaways?"
]

function getSourceIcon(type) {
  if (type === 'image') return '🖼️'
  if (type === 'pdf') return '📄'
  if (type === 'audio') return '🎵'
  if (type === 'video') return '🎬'
  if (type === 'table') return '📊'
  if (type === 'markdown') return '📑'
  return '📝'
}

export default function ChatWindow({ filesCount = 0 }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: WELCOME_TEXT,
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(queryText) {
    const q = (queryText || input).trim()
    if (!q || loading) return
    setInput('')
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { role: 'user', text: q, timestamp: time }])
    setLoading(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = { answer: text, sources: [] } }
      if (!res.ok) throw new Error(data.detail || 'Query failed')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `[SYSTEM ERROR] ${err.message || 'Could not reach neural query endpoint.'}`,
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-header-bar">
        <div className="chat-status-left">
          <span className="terminal-cursor">❯</span>
          <span className="chat-title">NEURAL QUERY CONSOLE</span>
        </div>
        <div className="chat-status-right">
          <span className="status-badge-mini">{filesCount} DATA SOURCES ACTIVE</span>
        </div>
      </div>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-wrapper">
              <div className="msg-sender-tag">
                {m.role === 'user' ? 'OPERATOR' : 'NEXUS-AI'} <span className="msg-time">{m.timestamp}</span>
              </div>
              <div className="bubble">
                <div className="bubble-text">{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="sources-container">
                    <div className="sources-header">
                      <span className="sources-label">// RETRIEVED VECTORS ({m.sources.length})</span>
                    </div>
                    <div className="sources-list">
                      {Array.from(new Set(m.sources.map(s => s.source))).map((sourceName, sIdx) => {
                        const sample = m.sources.find(s => s.source === sourceName)
                        const type = sample?.file_type || 'doc'
                        const scorePct = sample?.score ? Math.round(sample.score * 100) : null
                        return (
                          <div key={sIdx} className={`source-hud-card type-${type}`} title={sample?.text?.slice(0, 200)}>
                            <span className="source-icon">{getSourceIcon(type)}</span>
                            <span className="source-name">{sourceName}</span>
                            {scorePct && <span className="source-score">{scorePct}% MATCH</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-wrapper">
              <div className="msg-sender-tag">NEXUS-AI <span className="msg-time">QUERYING</span></div>
              <div className="bubble thinking">
                <div className="thinking-scanner"></div>
                <span className="thinking-text">Searching Pinecone Vector Index & Synthesizing Gemini Context...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 2 && (
        <div className="quick-prompts-bar">
          <span className="quick-prompts-label">SUGGESTED QUERIES:</span>
          <div className="quick-prompts-chips">
            {QUICK_PROMPTS.map((prompt, pIdx) => (
              <button
                key={pIdx}
                className="prompt-chip"
                onClick={() => send(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="input-bar">
        <span className="input-prompt-icon">❯</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={
            filesCount > 0
              ? "Query across documents, images, audio & video (e.g., 'What was discussed in the audio?')..."
              : "Upload files in the side panel, then input your query..."
          }
          disabled={loading}
        />
        <button className="send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
          <span>TRANSMIT</span>
          <span className="btn-glow"></span>
        </button>
      </div>
    </div>
  )
}


