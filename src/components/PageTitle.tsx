import type { ReactNode } from 'react';

/** Title of a main tab page: the logo, then the title in the page's colour. */
export default function PageTitle({ color, className = '', children }: { color: string; className?: string; children: ReactNode }) {
  return (
    <h1 className={`flex items-center gap-2 text-4xl ${color} ${className}`}>
      <img src="/icons/icon.svg" alt="" className="h-10 w-10 shrink-0" />
      {children}
    </h1>
  );
}
