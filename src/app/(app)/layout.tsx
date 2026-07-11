import BottomNav from '@/components/BottomNav'

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-36 pt-5">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
