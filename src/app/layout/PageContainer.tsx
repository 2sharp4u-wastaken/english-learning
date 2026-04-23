import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20 sm:px-6 sm:pb-6">
      {children}
    </main>
  )
}
