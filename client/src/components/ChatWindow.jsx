import { useEffect, useRef } from 'react';

function StatusDot({ status }) {
  const configs = {
    sent:       { label: 'Sent',       color: '#4a4f66' },
    queued:     { label: 'Queued',     color: '#6366f1' },
    processing: { label: 'Processing', color: '#f59e0b' },
    responded:  { label: 'Responded',  color: '#10b981' },
    error:      { label: 'Error',      color: '#ef4444' },
  };
  const c = configs[status] || configs.sent;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', color:c.color, fontFamily:'JetBrains Mono, monospace' }}>
      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:c.color, display:'inline-block',
        animation: status==='processing'?'pulse 1.2s ease-in-out infinite':'none' }} />
      {c.label}
    </span>
  );
}

function UserMessage({ message }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
      <div style={{ background:'#1e2d5a', border:'1px solid #2d4080', borderRadius:'12px 12px 4px 12px',
        padding:'10px 16px', maxWidth:'75%', color:'#e8eaf0', fontSize:'14px', lineHeight:'1.55' }}>
        {message.content}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', paddingRight:'2px' }}>
        <span style={{ fontSize:'11px', color:'#4a4f66', fontFamily:'JetBrains Mono, monospace' }}>
          {new Date(message.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
        </span>
        <StatusDot status={message.status} />
      </div>
    </div>
  );
}

function AIMessage({ message }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'6px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
        <div style={{ width:'24px', height:'24px', borderRadius:'50%',
          background:'linear-gradient(135deg, #4f6ef7, #7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'10px', fontWeight:600, color:'#fff', flexShrink:0 }}>AI</div>
        <span style={{ fontSize:'12px', color:'#8b90a8' }}>
          Assistant
          {message.intent && (
            <span style={{ marginLeft:'8px', padding:'1px 7px', background:'rgba(79,110,247,0.12)',
              color:'#4f6ef7', borderRadius:'999px', fontSize:'10px', fontFamily:'JetBrains Mono, monospace', fontWeight:500 }}>
              {message.intent}
            </span>
          )}
          {message.fromCache && (
            <span style={{ marginLeft:'6px', padding:'1px 7px', background:'rgba(16,185,129,0.1)',
              color:'#10b981', borderRadius:'999px', fontSize:'10px', fontFamily:'JetBrains Mono, monospace' }}>
              cached
            </span>
          )}
        </span>
      </div>
      <div style={{ background:'#1a1d26', border:'1px solid #2a2d3d', borderRadius:'4px 12px 12px 12px',
        padding:'10px 16px', maxWidth:'80%', color:'#e8eaf0', fontSize:'14px', lineHeight:'1.65', marginLeft:'32px' }}>
        {message.content}
      </div>
      {message.processingTimeMs && (
        <div style={{ marginLeft:'32px', fontSize:'11px', color:'#4a4f66', fontFamily:'JetBrains Mono, monospace' }}>
          ⚡ {message.processingTimeMs}ms
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'8px' }}>
      <div style={{ width:'24px', height:'24px', borderRadius:'50%',
        background:'linear-gradient(135deg, #4f6ef7, #7c3aed)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'10px', fontWeight:600, color:'#fff', flexShrink:0 }}>AI</div>
      <div style={{ background:'#1a1d26', border:'1px solid #2a2d3d',
        borderRadius:'4px 12px 12px 12px', padding:'12px 16px',
        display:'flex', gap:'5px', alignItems:'center' }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4a4f66',
            animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, isProcessing }) {
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,isProcessing]);

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ flex:1, overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', gap:'20px' }}>
        {messages.length === 0 && !isProcessing ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', color:'#4a4f66', textAlign:'center', gap:'16px', minHeight:'200px' }}>
            <div style={{ width:'64px', height:'64px', borderRadius:'50%',
              background:'rgba(79,110,247,0.12)', border:'1px solid #4f6ef7',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px' }}>🎙️</div>
            <div>
              <div style={{ fontSize:'16px', fontWeight:500, color:'#8b90a8', marginBottom:'6px' }}>
                Start a conversation
              </div>
              <div style={{ fontSize:'13px', color:'#4a4f66' }}>
                Type a message or simulate audio (try "audio_blob_123")
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg=>(
            <div key={msg.id} style={{ animation:'fadeIn 0.25s ease-out' }}>
              {msg.role==='user' ? <UserMessage message={msg} /> : <AIMessage message={msg} />}
            </div>
          ))
        )}
        {isProcessing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
