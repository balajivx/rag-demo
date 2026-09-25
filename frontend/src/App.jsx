import { useState, useMemo } from 'react'
import FileUpload from './components/FileUpload'
import ChatWindow from './components/ChatWindow'
import './App.css'

function getFileIcon(type, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return '🖼️'
  if (type === 'pdf' || ext === 'pdf') return '📄'
  if (type === 'audio' || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext)) return '🎵'
  if (type === 'video' || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return '🎬'
  if (type === 'table' || ['csv', 'tsv'].includes(ext)) return '📊'
  if (type === 'markdown' || ['md', 'markdown'].includes(ext)) return '📑'
  return '📝'
}

export default function App() {
  const [files, setFiles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  function handleUploads(newFiles) {
    setFiles((prev) => {
      const added = (newFiles || []).map((f, i) => ({
        id: `${f.filename || f.name}-${Date.now()}-${i}`,
        filename: f.filename || f.name,
        file_type: f.file_type || 'document',
        chunks: f.chunks || 0,
        status: f.status || 'success',
        error: f.error || null,
      }))
      const filtered = prev.filter(f => !newFiles.some(nf => (nf.filename || nf.name) === f.filename))
      return [...added, ...filtered]
    })
  }

  const totalChunks = files.reduce((sum, f) => sum + (f.chunks || 0), 0)

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    return files.filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [files, searchQuery])

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="brand-logo">
            <span className="logo-hex">⬡</span>
            <div>
              <div className="brand-title">
                NEXUS<span className="brand-accent">//RAG</span>
              </div>
              <div className="brand-sub">MULTIMODAL INTELLIGENCE ENGINE</div>
            </div>
          </div>
        </div>

        <div className="header-stats">
          <div className="hud-pill pulse">
            <span className="status-blip"></span>
            <span className="hud-label">KERNEL:</span>
            <span className="hud-val live">ONLINE</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">SOURCES:</span>
            <span className="hud-val">{files.length}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">VECTORS:</span>
            <span className="hud-val cyan">{totalChunks}</span>
          </div>
          <div className="hud-pill tech-pill">
            <span className="hud-label">ENGINE:</span>
            <span className="hud-val emerald">GEMINI FLASH</span>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <FileUpload onUpload={handleUploads} />

          <div className="file-list-section">
            <div className="file-list-header">
              <div className="file-list-title">
                <span className="terminal-prompt">//</span>
                <h3>INDEXED SOURCES ({filteredFiles.length}/{files.length})</h3>
              </div>
              {files.length > 0 && (
                <button
                  className="clear-btn"
                  onClick={() => setFiles([])}
                  title="Clear file list from view"
                >
                  [CLEAR]
                </button>
              )}
            </div>

            {files.length > 3 && (
              <div className="sidebar-search">
                <input
                  type="text"
                  placeholder="Filter sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}

            {files.length === 0 ? (
              <div className="empty-files">
                <span className="empty-icon">📡</span>
                <p>KNOWLEDGE BASE EMPTY</p>
                <span>Upload documents, images, audio, or video files to initialize vectors.</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="empty-files">
                <p>NO MATCHING SOURCES</p>
                <span>No files match "{searchQuery}"</span>
              </div>
            ) : (
              <ul className="file-list">
                {filteredFiles.map((f) => (
                  <li key={f.id} className={`file-card ${f.status} type-${f.file_type}`} title={f.filename}>
                    <div className="file-card-accent"></div>
                    <div className="file-card-content">
                      <div className="file-card-top">
                        <span className="file-icon">{getFileIcon(f.file_type, f.filename)}</span>
                        <span className="file-name">{f.filename}</span>
                      </div>
                      <div className="file-card-meta">
                        <span className={`type-badge tag-${f.file_type}`}>
                          {(f.file_type || 'doc').toUpperCase()}
                        </span>
                        {f.status === 'success' ? (
                          <span className="chunks-badge">{f.chunks} vectors</span>
                        ) : (
                          <span className="error-badge" title={f.error || 'Failed'}>ERR</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="chat-area">
          <ChatWindow filesCount={files.length} />
        </main>
      </div>
    </div>
  )
}


