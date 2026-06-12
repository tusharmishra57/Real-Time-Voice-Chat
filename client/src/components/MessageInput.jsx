import { useState, useRef } from 'react';

export default function MessageInput({ onSend, isConnected, isProcessing }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !isConnected || isProcessing) return;
    onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sendAudioSimulation = () => {
    if (!isConnected || isProcessing) return;
    onSend(`audio_blob_${Date.now()}`);
  };

  const canSend = text.trim().length > 0 && isConnected && !isProcessing;

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: '1px solid #2a2d3d',
      background: '#13161d',
    }}>
      {/* Simulated audio button */}
      <div style={{ marginBottom: '10px', display:'flex', gap:'8px' }}>
        <button
          onClick={sendAudioSimulation}
          disabled={!isConnected || isProcessing}
          style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'5px 12px', borderRadius:'999px',
            background:'rgba(79,110,247,0.1)', border:'1px solid rgba(79,110,247,0.3)',
            color: (!isConnected||isProcessing) ? '#4a4f66' : '#4f6ef7',
            fontSize:'12px', cursor: (!isConnected||isProcessing)?'not-allowed':'pointer',
            fontFamily:'JetBrains Mono, monospace', transition:'all 0.15s',
          }}
        >
          🎙️ Simulate Audio
        </button>
        <span style={{ fontSize:'11px', color:'#4a4f66', alignSelf:'center', fontFamily:'JetBrains Mono, monospace' }}>
          Sends a dummy audio blob through the STT pipeline
        </span>
      </div>

      {/* Text input row */}
      <div style={{
        display:'flex', gap:'10px', alignItems:'flex-end',
        background:'#1e2130', border:`1px solid ${canSend ? '#4f6ef7' : '#2a2d3d'}`,
        borderRadius:'12px', padding:'10px 12px',
        transition:'border-color 0.2s',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Type a message… (Enter to send)' : 'Connecting to server…'}
          disabled={!isConnected}
          rows={1}
          style={{
            flex:1, background:'transparent', border:'none', outline:'none',
            color:'#e8eaf0', fontSize:'14px', lineHeight:'1.5',
            fontFamily:'Inter, system-ui, sans-serif', resize:'none',
            maxHeight:'120px', overflowY:'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width:'34px', height:'34px', borderRadius:'8px', flexShrink:0,
            background: canSend ? 'linear-gradient(135deg, #4f6ef7, #7c3aed)' : '#2a2d3d',
            border:'none', cursor: canSend ? 'pointer' : 'not-allowed',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.2s', transform: canSend ? 'scale(1)' : 'scale(0.95)',
            boxShadow: canSend ? '0 2px 12px rgba(79,110,247,0.35)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke={canSend ? '#fff' : '#4a4f66'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={canSend ? '#fff' : '#4a4f66'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div style={{ marginTop:'8px', fontSize:'11px', color:'#4a4f66', fontFamily:'JetBrains Mono, monospace', textAlign:'center' }}>
        Shift+Enter for new line
      </div>
    </div>
  );
}
