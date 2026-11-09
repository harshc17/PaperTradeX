'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { API_URL } from '@/lib/config';
export default function ForgotPasswordPage() {
 const [step,setStep]=useState('email'), [email,setEmail]=useState(''), [code,setCode]=useState(''), [token,setToken]=useState(''), [password,setPassword]=useState(''), [confirm,setConfirm]=useState(''), [error,setError]=useState('');
 const [busy,setBusy]=useState(false), [cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(!cooldown)return; const t=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(t)},[cooldown]);
 async function api(path:string,body:object){const r=await fetch(`${API_URL}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Please try again.');return d;}
 async function send(){setBusy(true);setError('');try{await api('forgot-password',{email});setStep('code');setCode('');setCooldown(60);}catch(e){setError(e instanceof Error?e.message:'Unable to send code.');}finally{setBusy(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();if(step==='email')return send();setError('');if(step==='password'&&password!==confirm){setError('Passwords do not match.');return;}setBusy(true);try{if(step==='code'){const d=await api('verify-reset-otp',{email,code});setToken(d.token);setCode('');setStep('password');}else{await api('reset-password',{email,token,password});setToken('');setPassword('');setConfirm('');setStep('done');}}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false)}}
 const input='block min-w-0 w-full min-h-11 mt-2 px-4 py-3 rounded-xl bg-surface-2 border border-line focus:ring-2 focus:ring-primary';
 return <main className="min-h-[100svh] min-w-0 bg-[var(--bg)] text-ink flex items-start sm:items-center justify-center px-4 py-6 sm:p-6"><section className="min-w-0 break-words w-full max-w-md rounded-2xl border border-line bg-[var(--surface)] p-4 sm:p-8">
 <div className="mb-6 flex items-center justify-between gap-2"><BrandLogo className="text-[18px] min-[360px]:text-xl sm:text-[26px]" /><ThemeToggle /></div><h1 className="text-2xl font-medium mb-3">{step==='email'?'Forgot password?':step==='code'?'Check your email':step==='password'?'Set a new password':'Password updated'}</h1>
 <p className="text-sm text-ink-muted mb-6">{step==='email'?'Enter your account email to request a reset code.':step==='code'?`If ${email} has a password account, a six-digit code has been sent. Check spam too. The code expires in 10 minutes.`:step==='password'?'Use at least 8 characters with a letter and a number.':'Your password has changed. Sign in again on your devices.'}</p>
 {error&&<p role="alert" className="text-down mb-4">{error}</p>}
 {step!=='done'&&<form onSubmit={submit} className="space-y-4">
 {step==='email'&&<label className="block">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className={input}/></label>}
 {step==='code'&&<label className="block">Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className={input}/></label>}
 {step==='password'&&<><label className="block">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className={input}/></label><label className="block">Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} className={input}/></label></>}
 <button disabled={busy} className="min-h-12 w-full px-3 py-3 rounded-xl bg-primary text-[var(--primary-ink)] font-medium disabled:opacity-50">{busy?'Please wait…':step==='email'?'Send code':step==='code'?'Verify code':'Reset password'}</button></form>}
 {step==='code'&&<button disabled={busy||cooldown>0} onClick={send} className="min-h-11 text-left text-primary mt-2 disabled:text-ink-faint">{cooldown?`Resend code in ${cooldown}s`:'Resend code'}</button>}
 {(step==='code'||step==='password')&&<button disabled={busy} onClick={()=>{setStep('email');setToken('');setCode('');setError('')}} className="min-h-11 block text-left text-ink-muted mt-1">Start again</button>}
 <Link href="/login" className="inline-flex min-h-11 items-center text-primary mt-4">Back to login</Link></section></main>;
}
