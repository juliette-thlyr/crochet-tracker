import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import Login from './features/auth/Login';
import { useSession } from './features/auth/useSession';

export default function App() {
  const session = useSession();
  if (session === undefined) return <p className="p-6 text-muted">Loading…</p>;
  if (session === null) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<h1 className="p-4 text-3xl">Projects</h1>} />
      </Route>
    </Routes>
  );
}
