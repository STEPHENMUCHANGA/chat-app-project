import React, { useState } from 'react'

export default function Login({ onLogin }){
  const [name, setName] = useState('');
  return (
    <div className="login">
      <h2>Enter username</h2>
      <input placeholder="Your username" value={name} onChange={e=>setName(e.target.value)} />
      <button disabled={!name.trim()} onClick={()=>onLogin(name.trim())}>Join Chat</button>
      <p className="hint">This demo uses a simple username (no password).</p>
    </div>
  )
}
