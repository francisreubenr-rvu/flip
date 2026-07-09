'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PumpsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/pumps/dashboard') }, [router])
  return null
}
