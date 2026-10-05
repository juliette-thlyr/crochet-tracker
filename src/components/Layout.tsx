import { Outlet } from 'react-router';
import TabBar from './TabBar';

export default function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <div className="pb-36">
        <Outlet />
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md">
        <TabBar />
      </div>
    </div>
  );
}
