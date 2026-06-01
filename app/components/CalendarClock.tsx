'use client'
import { useState, useEffect, useRef } from 'react'

const HOUR_WORDS: Record<number, string> = {
  0: 'MIDNIGHT', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE',
  6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN', 11: 'ELEVEN',
  12: 'NOON', 13: 'ONE', 14: 'TWO', 15: 'THREE', 16: 'FOUR', 17: 'FIVE',
  18: 'SIX', 19: 'SEVEN', 20: 'EIGHT', 21: 'NINE', 22: 'TEN', 23: 'ELEVEN',
}

const WEEKDAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

function click(dur: number, vol: number) {
  try {
    const c = new (window.AudioContext||(window as any).webkitAudioContext)()
    const b = c.createBuffer(1,c.sampleRate*dur,c.sampleRate)
    const d = b.getChannelData(0)
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*0.003))
    const s=c.createBufferSource();s.buffer=b
    const g=c.createGain();g.gain.value=vol;s.connect(g);g.connect(c.destination);s.start()
    s.onended=()=>c.close()
  }catch(_){}
}

export default function CalendarClock({ compact }: { compact?: boolean }) {
  const [t,setT]=useState({h24:0,h12:0,m:0,s:0,ap:'AM'})
  const [prevM,setPrevM]=useState(-1)
  const [on,setOn]=useState(false)

  useEffect(()=>{
    setOn(true)
    const tick=()=>{
      const d=new Date()
      const h24=d.getHours()
      setT({h24,h12:h24%12||12,m:d.getMinutes(),s:d.getSeconds(),ap:h24<12?'AM':'PM'})
    }
    tick();const i=setInterval(tick,1000);return()=>clearInterval(i)
  },[])

  useEffect(()=>{
    if(t.m!==prevM&&prevM!==-1) click(0.03,0.03)
    setPrevM(t.m)
  },[t.m,prevM])

  if(!on) return compact?<span className="topbar-time">—</span>:null
  if(compact) return <span className="topbar-time">{HOUR_WORDS[t.h24]?.slice(0,3)} {String(t.m).padStart(2,'0')}:{String(t.s).padStart(2,'0')}</span>

  const now = new Date()
  const year=now.getFullYear(); const wday=WEEKDAYS[now.getDay()===0?6:now.getDay()-1]
  const sPct=(t.s/59)*100; const mTotal=t.h24*60+t.m

  return (
    <div style={{
      maxWidth: 560, width: '100%', margin: '0 auto',
      background: 'var(--page)', border: '1px solid var(--grid-major)',
      borderRadius: 3, position: 'relative', overflow: 'hidden',
      boxShadow: '0 4px 16px oklch(20% 0.02 40 / 0.08)',
    }}>
      {/* Red margin line */}
      <div style={{position:'absolute',top:0,bottom:0,left:44,width:1,
        background:'var(--margin)',opacity:0.35,zIndex:2,pointerEvents:'none'}}/>

      {/* ── Zone 1: Hour header ────────────────────────────────────── */}
      <div style={{
        padding:'18px 20px 14px 56px',
        borderBottom:'1px solid var(--grid-major)',
        position:'relative'
      }}>
        <div style={{
          fontFamily:'var(--serif)',fontSize:'clamp(48px,7vw,96px)',
          fontStyle:'italic',fontWeight:700,color:'var(--ink-100)',
          lineHeight:0.9,letterSpacing:'-0.02em',
        }}>
          {HOUR_WORDS[t.h24]}
        </div>
        <div style={{
          fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-40)',
          letterSpacing:'0.14em',textTransform:'uppercase',marginTop:4,
        }}>
          {year} {t.ap} · {wday} · page {mTotal}
        </div>
        {/* Hour badge */}
        <span style={{
          position:'absolute',top:18,right:16,
          fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-25)',
          letterSpacing:'0.1em'
        }}>
          {String(t.h24).padStart(2,'0')}
        </span>
      </div>

      {/* ── Zone 2: Minute grid ─────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 8px 56px' }}>
        {/* Column headers */}
        <div style={{
          display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,
          marginBottom:4,
        }}>
          {WEEKDAYS.map(d=>(<div key={d} style={{
            textAlign:'center',fontFamily:'var(--mono)',fontSize:8,
            color:'var(--ink-25)',letterSpacing:'0.08em',padding:'2px 0'
          }}>{d}</div>))}
        </div>
        {/* Minute rows */}
        {[[0,1,2,3,4,5,6],[7,8,9,10,11,12,13],[14,15,16,17,18,19,20],
          [21,22,23,24,25,26,27],[28,29,30,31,32,33,34],[35,36,37,38,39,40,41],
          [42,43,44,45,46,47,48],[49,50,51,52,53,54,55],[56,57,58,59]].map((row,ri)=>(
          <div key={ri} style={{
            display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,
            marginBottom:2,
          }}>
            {row.map((mn,i)=>(<div key={i} style={{
              textAlign:'center',padding:'6px 0',
              fontFamily:'var(--mono)',fontSize:12,fontWeight:mn===t.m?700:400,
              color:mn===t.m?'var(--page)':'var(--ink-40)',
              background:mn===t.m?'var(--accent)':'transparent',
              borderRadius:mn===t.m?2:0,
              transition:'background 0.25s var(--ease-out-quart), color 0.25s var(--ease-out-quart)',
            }}>{String(mn).padStart(2,'0')}</div>))}
          </div>
        ))}
      </div>

      {/* ── Zone 3: Seconds footer ──────────────────────────────────── */}
      <div style={{
        borderTop:'1px solid var(--grid-major)',
        padding:'10px 20px 10px 56px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        gap:16,
      }}>
        <span style={{
          fontFamily:'var(--mono)',fontSize:9,color:'var(--ink-40)',
          letterSpacing:'0.16em',textTransform:'uppercase'
        }}>seconds</span>
        <span style={{
          fontFamily:'var(--mono)',fontSize:13,color:'var(--ink-80)',
          letterSpacing:'0.06em',fontVariantNumeric:'tabular-nums'
        }}>{String(t.s).padStart(2,'0')} / 59</span>
      </div>
      {/* Progress bar */}
      <div style={{
        height:2,background:'var(--grid-minor)',position:'relative'
      }}>
        <div style={{
          position:'absolute',inset:0,background:'var(--accent)',
          width:`${sPct}%`,transition:'width 1s linear',
        }}/>
      </div>

      {/* Edge tick strip (right side, page index) */}
      <div style={{
        position:'absolute',right:0,top:0,bottom:0,width:5,
        display:'flex',flexDirection:'column',justifyContent:'space-evenly',
        padding:'4px 0',
      }}>
        {Array.from({length:30}).map((_,i)=>(<div key={i} style={{
          height:1,width:'100%',
          background:i===Math.floor(t.s/2)?'var(--accent)':'var(--grid-minor)',
          borderRadius:0.5,transition:'background 0.3s ease'
        }}/>))}
      </div>
    </div>
  )
}
