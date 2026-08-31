import BottomNav from '@/components/BottomNav'
import PageTransition from '@/components/PageTransition'

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-[calc(100vh-env(safe-area-inset-top))] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <BottomNav />
      <main className="w-full min-w-0 px-5 pb-36 pt-5 sm:px-8 lg:px-10 lg:pb-10 lg:pt-8 xl:px-14">
        <div className="mx-auto w-full max-w-7xl">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  )
}
