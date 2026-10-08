import { Outlet } from 'react-router';
import TimerBar from '../features/timer/TimerBar';
import TabBar from './TabBar';

export default function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="flex items-center gap-2 px-4 pt-3">
        <img src="/icons/icon.svg" alt="" className="h-10 w-10" />
        <span className="text-xl text-projects">Crochet Tracker</span>
      </header>
      <div className="pb-36">
        <Outlet />
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md">
        <TimerBar />
        <TabBar />
      </div>
    </div>
  );
}
