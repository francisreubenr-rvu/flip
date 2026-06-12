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
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
        <div className="flex items-center gap-4">
          <Link href="/pumps/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded" style={{ background: 'var(--accent)' }}>
              <Dumbbell className="h-4 w-4" style={{ color: 'var(--page)' }} />
            </div>
            <span className="font-bold text-lg tracking-tight font-[var(--serif)] italic" style={{ color: 'var(--ink-100)' }}>Pumps</span>
          </Link>
          <Link href="/" className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--ink-40)' }}>
            <ArrowLeft className="h-3 w-3" />
            Flip
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/pumps/settings" className="text-xs hover:underline" style={{ color: 'var(--ink-60)' }}>
            {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'You'}
          </Link>
        </div>
      </header>

      {/* Nav sidebar on desktop */}
      <div className="flex min-h-[calc(100vh-49px)]">
        <nav className="hidden lg:flex flex-col w-48 border-r p-3 gap-1 sticky top-[49px] h-[calc(100vh-49px)]" style={{ borderColor: 'var(--grid-major)', background: 'var(--page-cream)' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-[var(--mono)] transition-colors"
                style={{
                  color: isActive ? 'var(--page)' : 'var(--ink-60)',
                  background: isActive ? 'var(--accent)' : 'transparent',
                  fontSize: '0.75rem',
                  letterSpacing: '0.025em',
                }}
              >
                <item.icon className="h-3.5 w-3.5" />
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
                className="flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-[var(--mono)]"
                style={{ color: isActive ? 'var(--accent)' : 'var(--ink-40)' }}
              >
                <item.icon className="h-4 w-4" />
                <span className="tracking-wider">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
