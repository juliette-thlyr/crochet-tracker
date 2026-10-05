import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import Login from './features/auth/Login';
import { useSession } from './features/auth/useSession';
import PatternForm from './features/patterns/PatternForm';
import PatternList from './features/patterns/PatternList';
import PatternPage from './features/patterns/PatternPage';
import TypesPage from './features/patterns/TypesPage';
import PartPage from './features/parts/PartPage';
import NewProject from './features/projects/NewProject';
import ProjectList from './features/projects/ProjectList';
import ProjectPage from './features/projects/ProjectPage';
import TimerTab from './features/timer/TimerTab';
import StashList from './features/stash/StashList';
import YarnForm from './features/stash/YarnForm';
import YarnPage from './features/stash/YarnPage';

export default function App() {
  const session = useSession();
  if (session === undefined) return <p className="p-6 text-muted">Loading…</p>;
  if (session === null) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ProjectList />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="parts/:id" element={<PartPage />} />
        <Route path="patterns" element={<PatternList />} />
        <Route path="patterns/new" element={<PatternForm />} />
        <Route path="patterns/types" element={<TypesPage />} />
        <Route path="patterns/:id" element={<PatternPage />} />
        <Route path="patterns/:id/edit" element={<PatternForm />} />
        <Route path="timer" element={<TimerTab />} />
        <Route path="stash" element={<StashList />} />
        <Route path="stash/new" element={<YarnForm />} />
        <Route path="stash/:id" element={<YarnPage />} />
        <Route path="stash/:id/edit" element={<YarnForm />} />
      </Route>
    </Routes>
  );
}
