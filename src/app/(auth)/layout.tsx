export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="bg-card-gradient size-8 rounded-lg" />
        <span className="text-lg font-semibold">Pulse Wallet</span>
      </div>
      {children}
    </main>
  );
}
