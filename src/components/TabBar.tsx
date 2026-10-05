import { Link, useLocation } from 'react-router';
import { GridIcon, HookIcon, HourglassIcon, YarnIcon } from './icons';

const tabs = [
  { to: '/', label: 'Projects', Icon: GridIcon, on: 'text-projects',
    match: (p: string) => p === '/' || p.startsWith('/projects') || p.startsWith('/parts') },
  { to: '/patterns', label: 'Patterns', Icon: HookIcon, on: 'text-patterns', match: (p: string) => p.startsWith('/patterns') },
  { to: '/stash', label: 'Stash', Icon: YarnIcon, on: 'text-stash', match: (p: string) => p.startsWith('/stash') },
  { to: '/timer', label: 'Timer', Icon: HourglassIcon, on: 'text-timer', match: (p: string) => p.startsWith('/timer') },
];

export default function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="flex h-[72px] border-t border-line bg-surface">
      {tabs.map(({ to, label, Icon, on, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${active ? on : 'text-muted'}`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
