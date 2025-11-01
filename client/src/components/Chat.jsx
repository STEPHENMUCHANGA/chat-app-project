import React, { useEffect, useState, useRef } from 'react'

export default function Chat({ socket, username, onLogout }){
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [online, setOnline] = useState([]);
  const [room, setRoom] = useState('global');
  const pageRef = useRef(0);
  const listRef = useRef();

  useEffect(()=>{
    if(!socket) return;
    socket.emit('user:join', { username }, (res)=> {
      console.log('joined', res);
      if(res && res.recent) setMessages(res.recent || []);
      else socket.emit('message:history', { room, page:0 }, (h)=> setMessages(h.messages || []));
    });

    socket.on('connect', ()=> setConnected(true));
    socket.on('disconnect', ()=> setConnected(false));

    socket.on('message:new', (m) => {
      setMessages(prev=>[...prev, m]);
      if(Notification && Notification.permission === 'granted' && m.from !== username){
        new Notification('New message', { body: `${m.from}: ${m.text||m.type}`});
      }
      const audio = document.getElementById('ding');
      if(audio && m.from !== username) audio.play().catch(()=>{});
    });

    socket.on('presence:update', (list) => setOnline(list || []));
    socket.on('typing', ({ username: who })=>{
      setTypingUsers(prev => prev.includes(who)? prev : [...prev, who]);
      setTimeout(()=> setTypingUsers(prev => prev.filter(x=>x!==who)), 1500);
    });

    socket.on('notification', (n) => {
      console.log('notification', n);
    });

    socket.on('reaction:update', ({ messageId, emoji, users }) => {
      setMessages(prev => prev.map(m => m._id===messageId ? {...m, reactions:{...m.reactions, [emoji]: users}} : m));
    });

    return ()=> {
      socket.off('message:new');
      socket.off('presence:update');
      socket.off('typing');
      socket.off('reaction:update');
    }
  }, [socket, room]);

  useEffect(()=>{
    if(Notification && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(()=>{});
    }
  }, []);

  const send = () => {
    if(!text.trim()) return;
    socket.emit('message:send', { room, from: username, text }, (ack)=> {
      // handle ack
    });
    setText('');
  };

  const startTyping = () => {
    socket.emit('typing', { room, username });
  };

  const loadOlder = () => {
    const p = ++pageRef.current;
    socket.emit('message:history', { room, page: p }, (h) => {
      setMessages(prev => [...h.messages, ...prev]);
    });
  };

  const react = (id, emoji) => {
    socket.emit('reaction', { messageId: id, emoji, username });
  };

  const uploadFile = async (file) => {
    const data = new FormData();
    data.append('file', file);
    const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3000') + '/upload', { method:'POST', body: data });
    const json = await res.json();
    if(json.url){
      socket.emit('message:send', { room, from: username, type:'file', metadata:{ url: (import.meta.env.VITE_SERVER_URL || 'http://localhost:3000') + json.url } });
    }
  };

  return (
    <div className="chat">
      <audio id="ding" src="/ding.mp3" preload="auto"></audio>
      <header>
        <h3>Realtime Chat - Room: {room}</h3>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div className="presence">Online: {online.join(', ')}</div>
          <div style={{fontSize:12,color: connected ? 'green' : 'gray'}}>{connected ? 'Connected' : 'Disconnected'}</div>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main ref={listRef} className="messages">
        <button onClick={loadOlder} className="load-older">Load older</button>
        {messages.map(m => (
          <div key={m._id || m.id} className={'message ' + (m.from===username? 'me':'')}>
            <div className="meta">
              <strong>{m.from}</strong> <span className="ts">{new Date(m.ts || m.ts).toLocaleTimeString()}</span>
            </div>
            <div className="body">
              {m.type === 'file' ? <a href={m.metadata?.url} target="_blank" rel="noreferrer">Download file</a> : <span>{m.text}</span>}
            </div>
            <div className="actions">
              <button onClick={()=>react(m._id||m.id, '👍')}>👍</button>
              <button onClick={()=>react(m._id||m.id, '❤️')}>❤️</button>
              <button onClick={()=>socket.emit('message:ack', { messageId: m._id||m.id, username })}>Mark Read</button>
            </div>
            <div className="reactions">
              {m.reactions && Object.entries(m.reactions).map(([emoji, users])=> <span key={emoji}>{emoji} {users.length}</span>)}
            </div>
          </div>
        ))}
      </main>

      <footer>
        <input type="file" onChange={e=>uploadFile(e.target.files[0])} />
        <input value={text} onChange={e=>setText(e.target.value)} onKeyPress={e=>{ if(e.key==='Enter') send(); else startTyping(); }} placeholder="Type a message..." />
        <button onClick={send}>Send</button>
      </footer>

      <div className="typing">{typingUsers.filter(t=>t!==username).join(', ')} {typingUsers.length>0 ? 'is typing...':''}</div>
    </div>
  )
}
