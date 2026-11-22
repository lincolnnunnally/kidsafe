import Link from "next/link";

// Kid Safe's top bar.
export function KidTopBar({ right }: { right?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <svg className="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M16 2 4 6.5v8.2C4 22.3 9.1 28 16 30c6.9-2 12-7.7 12-15.3V6.5Z" />
            <path fill="#f2b134" d="m16 9 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7Z" />
          </svg>
          <span>Kid <span className="brand-accent">Safe</span></span>
        </Link>
        {right ?? <Link href="/family" className="btn btn-ghost btn-sm">My family</Link>}
      </div>
    </div>
  );
}
