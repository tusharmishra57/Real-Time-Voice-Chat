/**
 * App.jsx — Root component
 * Manages WebSocket lifecycle, message state, and status tracking.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import socket from './services/socket';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CONNECTION_STATUS = {
  connecting:   { label: 'Connecting…',  color: '#f59e0b' },
  connected:    { label: 'Connected',    color: '#10b981' },
  disconnected: { label: 'Disconnected', color: '#ef4444' },
  error:        { label: 'Error',        color: '#ef4444' },
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const pendingRef = useRef(null);

  const updateMessage = useCallback((id, updates) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  useEffect(() => {
    setConnectionStatus('connecting');
    socket.connect();

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => { setConnectionStatus('disconnected'); setIsProcessing(false); });
    socket.on('connect_error', () => setConnectionStatus('error'));
    socket.on('connected', ({ userId }) => console.log('[WS] userId:', userId));

    socket.on('status_update', ({ status }) => {
      if (pendingRef.current) updateMessage(pendingRef.current, { status });
      if (status === 'processing' || status === 'queued') setIsProcessing(true);
    });

    socket.on('ai_response', ({ response, intent, fromCache, processingTimeMs, processedText }) => {
      setIsProcessing(false);
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === pendingRef.current ? { ...m, status: 'responded' } : m
        );
        return [...updated, {
          id: generateId(), role: 'ai', content: response,
          intent, fromCache, processingTimeMs, processedText,
          timestamp: new Date().toISOString(),
        }];
      });
      pendingRef.current = null;
    });

    socket.on('rate_limited', ({ message, resetInMs }) => {
      setIsProcessing(false);
      setRateLimitInfo({ message, resetInMs });
      if (pendingRef.current) { updateMessage(pendingRef.current, { status: 'error' }); pendingRef.current = null; }
      setTimeout(() => setRateLimitInfo(null), resetInMs);
    });

    socket.on('error', () => {
      setIsProcessing(false);
      if (pendingRef.current) { updateMessage(pendingRef.current, { status: 'error' }); pendingRef.current = null; }
    });

    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [updateMessage]);

  const handleSend = useCallback((text) => {
    const id = generateId();
    const isAudio = text.startsWith('audio_') || text.startsWith('blob:');
    setMessages(prev => [...prev, {
      id, role: 'user',
      content: isAudio ? `🎙️ Audio: ${text}` : text,
      status: 'sent', timestamp: new Date().toISOString(),
    }]);
    pendingRef.current = id;
    socket.emit('send_message', { message: text });
  }, []);

  const connConfig = CONNECTION_STATUS[connectionStatus] || CONNECTION_STATUS.disconnected;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0d0f14', overflow:'hidden' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#0d0f14; color:#e8eaf0; font-family:'Inter',system-ui,sans-serif; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2d3d; border-radius:999px; }
      `}</style>

      {/* Header */}
      <header style={{ padding:'14px 20px', borderBottom:'1px solid #2a2d3d', background:'#13161d',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px',
            background:'linear-gradient(135deg, #4f6ef7, #7c3aed)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>🤖</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:600, color:'#e8eaf0', lineHeight:1.2 }}>AI Voice Assistant</div>
            <div style={{ fontSize:'11px', color:'#4a4f66', fontFamily:'JetBrains Mono, monospace' }}>
              WebSocket · BullMQ · Redis · MongoDB
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:connConfig.color,
            animation: connectionStatus!=='connected' ? 'pulse 1.5s infinite' : 'none' }} />
          <span style={{ fontSize:'12px', color:connConfig.color, fontFamily:'JetBrains Mono, monospace' }}>
            {connConfig.label}
          </span>
        </div>
      </header>

      {/* Rate limit banner */}
      {rateLimitInfo && (
        <div style={{ padding:'10px 20px', background:'rgba(239,68,68,0.1)',
          borderBottom:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:'13px', textAlign:'center' }}>
          ⚠️ {rateLimitInfo.message}
        </div>
      )}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <ChatWindow messages={messages} isProcessing={isProcessing} />
        <MessageInput onSend={handleSend}
          isConnected={connectionStatus === 'connected'}
          isProcessing={isProcessing} />
      </div>
    </div>
  );
}
