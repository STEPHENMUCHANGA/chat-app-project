import React, { useState } from 'react'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export default function LoginForm({ onLogin }){
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');

  const submit = async () => {
    const url = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(SERVER + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim(), password })
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json.error || 'Auth failed');
      onLogin({ username: json.username, token: json.token });
    } catch(e) {
      setErr(e.message);
    }
  };

  return (
    <div className="login">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <input placeholder="Username" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button disabled={!name||!password} onClick={submit}>{mode === 'login' ? 'Login' : 'Register'}</button>
        <button onClick={()=>setMode(mode === 'login' ? 'register' : 'login')}>Switch to {mode === 'login' ? 'Register' : 'Login'}</button>
      </div>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <p className="hint">This demo stores a JWT token in localStorage for socket auth.</p>
    </div>
  )
}
