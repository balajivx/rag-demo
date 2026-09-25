import { useState, useRef, useEffect } from 'react'
import './ChatWindow.css'

const WELCOME = 'Hello! Upload any documents, audio, or video files in the sidebar, then ask me anything about them.'

function getSourceIcon(type) {
  if (type === 'pdf') return '📄'
  if (type === 'audio') return '🎵'
  if (type === 'video') return '🎬'
  if (type === 'table') return '📊'
  if (type === 'markdown') return '📑'
  return '📝'
}

export default function ChatWindow({ filesCount = 0 }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME, sources: [] }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
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
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error: could not reach the server.',
          sources: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              <div className="bubble-text">{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="sources-container">
                  <span className="sources-label">Sources:</span>
                  <div className="sources-list">
                    {Array.from(new Set(m.sources.map(s => s.source))).map((sourceName, sIdx) => {
                      const sample = m.sources.find(s => s.source === sourceName)
                      const type = sample?.file_type || 'doc'
                      return (
                        <span key={sIdx} className="source-tag" title={sample?.text?.slice(0, 150)}>
                          {getSourceIcon(type)} {sourceName}
                          {sample?.score ? ` (${Math.round(sample.score * 100)}%)` : ''}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="bubble thinking">
              <span>Thinking and searching knowledge base…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={filesCount > 0 ? "Ask a question about your uploaded sources…" : "Upload documents or media, then ask anything…"}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}

