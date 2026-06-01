'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

type Ch = { id:string; label:string; sub:string; gen:(c:AudioContext)=>AudioNode }

function pinkNoise(ctx: AudioContext, gain = 1): AudioNode {
  const size = ctx.sampleRate * 4
  const buf = ctx.createBuffer(2, size, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < size; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * gain
      b6 = w * 0.115926
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const g = ctx.createGain()
  g.gain.value = 1
  src.connect(g)
  src.start()
  return g
}

const CHANNELS:Ch[]=[
  { id:'rain', label:'Rain', sub:'filtered noise', gen(ctx){
    const g=pinkNoise(ctx,0.9);const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=300;const o=ctx.createGain();o.gain.value=1;(g as GainNode).connect(hp);hp.connect(o);return o
  }},
  { id:'binaural', label:'Binaural', sub:'theta 6Hz', gen(ctx){
    const m=ctx.createChannelMerger(2);const o1=ctx.createOscillator(),o2=ctx.createOscillator()
    o1.frequency.value=40;o2.frequency.value=46;o1.type=o2.type='sine'
    const g1=ctx.createGain(),g2=ctx.createGain();g1.gain.value=g2.gain.value=0.12
    o1.connect(g1);o2.connect(g2);g1.connect(m,0,0);g2.connect(m,0,1);o1.start();o2.start()
    const n=pinkNoise(ctx,0.06);const o=ctx.createGain();o.gain.value=1;m.connect(o);n.connect(o);return o
  }},
  { id:'cafe', label:'Café', sub:'brownian murmur', gen(ctx){
    const s=ctx.sampleRate*2;const b=ctx.createBuffer(2,s,ctx.sampleRate)
    for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<s;i++)d[i]=Math.random()*2-1}
    const src=ctx.createBufferSource();src.buffer=b;src.loop=true;const g=ctx.createGain();g.gain.value=0.15;src.connect(g);src.start()
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;g.connect(lp);return lp
  }},
  { id:'forest', label:'Forest', sub:'soft nature', gen(ctx){
    const g=pinkNoise(ctx,0.7);const pk=ctx.createBiquadFilter();pk.type='peaking';pk.frequency.value=2000;pk.gain.value=8;pk.Q.value=0.8;const o=ctx.createGain();o.gain.value=1;(g as GainNode).connect(pk);pk.connect(o);return o
  }},
  { id:'brown', label:'Brown', sub:'low frequency', gen(ctx){
    const s=ctx.sampleRate*4;const b=ctx.createBuffer(1,s,ctx.sampleRate);const d=b.getChannelData(0);let last=0
    for(let i=0;i<s;i++){const w=Math.random()*2-1;d[i]=(last+(0.02*w))/1.02;last=d[i];d[i]*=4}
    const src=ctx.createBufferSource();src.buffer=b;src.loop=true;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=600;const g=ctx.createGain();g.gain.value=0.7;src.connect(lp);lp.connect(g);src.start();return g
  }},
]

const NOTES:Record<string,string>={rain:'Filtered noise masks speech-frequency distractors without any semantic content to process.',binaural:'Theta (6Hz) beats — small but significant memory + attention effects. ~30% of users show no cortical entrainment. Use headphones.',cafe:'Brownian murmur provides auditory presence without lyrical interference or attention capture.',forest:'Nature sounds have the strongest cross-study evidence for focus. Scientific Reports fMRI (2017): parasympathetic activation.',brown:'Deep low-frequency masking. Anecdotally preferred for high-cognitive-load reading and writing tasks.'}

export default function MusicPlayer() {
  const [playing,setPlaying]=useState(false);const [ch,setCh]=useState(CHANNELS[0])
  const [vol,setVol]=useState(0.5);const [muted,setMuted]=useState(false);const [elapsed,setElapsed]=useState(0)
  const ctxRef=useRef<AudioContext|null>(null);const mstRef=useRef<GainNode|null>(null);const timRef=useRef<ReturnType<typeof setInterval>|null>(null)

  const stop=useCallback(()=>{if(mstRef.current&&ctxRef.current){mstRef.current.gain.setTargetAtTime(0,ctxRef.current.currentTime,0.3);const o=ctxRef.current;setTimeout(()=>o.close(),400)}ctxRef.current=null;mstRef.current=null;if(timRef.current)clearInterval(timRef.current)},[])
  const start=useCallback(async(c:Ch)=>{if(ctxRef.current)stop();const ctx=new (window.AudioContext||(window as any).webkitAudioContext)();await ctx.resume();const m=ctx.createGain();m.gain.value=muted?0:vol;const n=c.gen(ctx);n.connect(m);m.connect(ctx.destination);ctxRef.current=ctx;mstRef.current=m;timRef.current=setInterval(()=>setElapsed(e=>e+1),1000)},[stop,vol,muted])
  const toggle=useCallback(async()=>{if(playing){stop();setPlaying(false)}else{await start(ch);setPlaying(true)}},[playing,ch,start,stop])
  const sw=useCallback(async(c:Ch)=>{setCh(c);setElapsed(0);if(playing)await start(c)},[playing,start])
  useEffect(()=>{if(mstRef.current&&ctxRef.current)mstRef.current.gain.setTargetAtTime(muted?0:vol,ctxRef.current.currentTime,0.1)},[vol,muted])
  useEffect(()=>()=>{if(ctxRef.current)stop()},[stop])

  const fmt=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const bars = Array.from({ length: 52 }, (_, i) => {
    const h = Math.abs(Math.sin(i * 0.5 + 1) * 60 + Math.sin(i * 1.3) * 30) + 10
    return { h: h.toFixed(2), d: ((i % 7) * 0.07).toFixed(2), dur: (0.5 + (i % 5) * 0.16).toFixed(2) }
  })

  return (
    <div className="sound-layout">
      <div className="channel-list">
        {CHANNELS.map((c,i)=>(
          <button key={c.id} className={`channel-item ${ch.id===c.id?'active':''}`} onClick={()=>sw(c)}>
            <span className="ch-num">{String(i+1).padStart(2,'0')}</span>
            <div><span className="ch-name">{c.label}</span><br/><span className="ch-sub">{c.sub}</span></div>
            <span className="ch-state">{ch.id===c.id?(playing?'▶ play':'— sel'):''}</span>
          </button>
        ))}
      </div>
      <div className="sound-stage">
        <div className="now-playing">
          <div><div className="np-label">Now playing</div><div className="np-name">{ch.label}</div></div>
          <span className="np-elapsed">{fmt(elapsed)}</span>
        </div>
        <div className="waveform-big">{bars.map((b,i)=>(
          <div key={i} className={`wave-bar ${playing?'live':''}`} style={{
            height: `${b.h}%`,
            ...(playing ? { animationDuration: `${b.dur}s`, animationDelay: `${b.d}s` } : {}),
          }}/>
        ))}</div>
        <div className="sound-ctrls">
          <button className="btn-circle" onClick={()=>setMuted(m=>!m)} aria-label="Mute">{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
          <button className="btn-circle primary" onClick={toggle} aria-label={playing?'Pause':'Play'}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
          <input className="vol-slider" type="range" min="0" max="1" step="0.02" value={vol} onChange={e=>setVol(Number(e.target.value))} aria-label="Volume"/>
        </div>
        <div className="sound-footnote">{NOTES[ch.id]}</div>
      </div>
    </div>
  )
}
