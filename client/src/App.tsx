const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
          WebDev@GT
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">CalendAction</h1>
        <p className="mt-4 text-lg text-slate-600">
          Hello. This is the starter app, and Tailwind is on.
        </p>
        <p className="mt-8 text-sm text-slate-500">
          API base URL:{" "}
          <span className="font-mono text-slate-700">{apiUrl}</span>
        </p>
      </div>
    </main>
  );
}
