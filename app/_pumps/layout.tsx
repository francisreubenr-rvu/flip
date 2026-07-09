'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/app/lib/auth'
import { Dumbbell, LayoutDashboard, ListTodo, Trophy, Swords, TrendingUp, Library, ArrowLeft } from 'lucide-react'

const navItems = [
  { href: '/pumps/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pumps/workouts', label: 'Workouts', icon: ListTodo },
  { href: '/pumps/exercises', label: 'Exercises', icon: Library },
  { href: '/pumps/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/pumps/competitions', label: 'Compete', icon: Swords },
  { href: '/pumps/progress', label: 'Progress', icon: TrendingUp },
]

export default function PumpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/signin')
  }, [user, loading, router])

  if (loading) {
    return <div className="flex h-full items-center justify-center font-[var(--mono)] text-[var(--ink-40)]">…</div>
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--page)' }}>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
        <div className="flex items-center gap-5">
          <Link href="/pumps/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded" style={{ background: 'var(--accent)' }}>
              <Dumbbell className="h-4 w-4" style={{ color: 'var(--page)' }} />
            </div>
            <span className="text-xl font-[var(--serif)] italic" style={{ color: 'var(--ink-100)' }}>Pumps</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 font-[var(--mono)] hover:opacity-70 transition-opacity" style={{ color: 'var(--ink-40)', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
            <ArrowLeft className="h-3 w-3" />
            flip
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/pumps/settings" className="font-[var(--mono)] hover:opacity-70 transition-opacity" style={{ color: 'var(--ink-40)', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
            {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'you'}
          </Link>
        </div>
      </header>

      {/* Nav sidebar on desktop */}
      <div className="flex min-h-[calc(100vh-57px)]">
        <nav className="hidden lg:flex flex-col w-56 border-r px-4 py-6 gap-0.5 sticky top-[57px] h-[calc(100vh-57px)]" style={{ borderColor: 'var(--grid-major)', background: 'transparent' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 font-[var(--mono)] transition-colors"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--ink-60)',
                  background: 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  fontSize: '0.8125rem',
                  letterSpacing: '0.03em',
                  borderRadius: 0,
                }}
              >
                <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center py-3 gap-1 font-[var(--mono)]"
                style={{ color: isActive ? 'var(--accent)' : 'var(--ink-40)', fontSize: '0.625rem', letterSpacing: '0.06em' }}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-10" style={{ padding: 'clamp(1.5rem, 3vw, 2.5rem) clamp(1.5rem, 4vw, 2.5rem)' }}>
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
