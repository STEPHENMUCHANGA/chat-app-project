import React, { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import Chat from './components/Chat'
import LoginForm from './components/LoginForm'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export default function App(){
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(()=> {
    const s = localStorage.getItem('rtc_user');
    return s ? JSON.parse(s) : null;
  });

  useEffect(()=>{
    if(user && !socket){
      const s = io(SERVER, { transports:['websocket'], auth: { token: user.token } });
      setSocket(s);
      s.on('connect', ()=> console.log('connected', s.id));
      s.on('disconnect', ()=> console.log('disconnected'));
    }
  }, [user]);

  return (
    <div className="app">
      {user ? <Chat socket={socket} username={user.username} onLogout={() => { localStorage.removeItem('rtc_user'); setUser(null); if(socket) socket.disconnect(); setSocket(null); }} /> : <LoginForm onLogin={(u)=>{ setUser(u); localStorage.setItem('rtc_user', JSON.stringify(u)); }} />}
    </div>
  )
}
