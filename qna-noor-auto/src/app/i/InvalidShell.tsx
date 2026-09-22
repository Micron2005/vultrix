export function InvalidShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Link not valid</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This intake link is invalid or has expired. Please scan the QR code
          posted in the shop again, or ask the front desk for a fresh link.
        </p>
      </div>
    </div>
  );
}
