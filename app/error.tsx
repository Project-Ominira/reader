"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-3 bg-sand-50 text-center px-6">
      <h1 className="text-xl font-semibold font-serif text-sand-950">
        This book couldn&apos;t be loaded
      </h1>
      <p className="text-sm text-sand-600 max-w-md">{error.message}</p>
      <button
        onClick={reset}
        className="mt-2 px-4 py-2 rounded-sm bg-brand-500 text-white text-sm font-medium cursor-pointer border-none"
      >
        Try again
      </button>
    </div>
  );
}
