type IconProps = { className?: string };

const base = {
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

export function HookIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 19 16.5 7.5" />
      <path d="M16.5 7.5c1.2-1.2 1.6-3.2.6-4.2s-2.9-.4-3.4.8c-.3.7.3 1.4 1.1 1.1" />
      <path d="M3.5 20.5 7 17" />
    </svg>
  );
}

export function YarnIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" /><path d="M5 8c4 1 10 1 14 0" />
      <path d="M4 13c5 1.5 11 1.5 16 0" /><path d="M7 18.5c3.5 1 7 1 10 0" />
    </svg>
  );
}

export function HourglassIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12" /><path d="M6 21h12" />
      <path d="M7.5 3v2c0 3 4.5 5 4.5 7s-4.5 4-4.5 7v2" />
      <path d="M16.5 3v2c0 3-4.5 5-4.5 7s4.5 4 4.5 7v2" />
      <path d="M9.5 19h5" />
    </svg>
  );
}
