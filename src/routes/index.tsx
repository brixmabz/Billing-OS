import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import Navbar from '../components/layout/Navbar';

// Pages
import Login from '../pages/Login';
import MyRequests from '../pages/collector/MyRequests';
import NewRequest from '../pages/collector/NewRequest';
import DebtorCommunications from '../pages/collector/DebtorCommunications';
import Queue from '../pages/admin/Queue';
import Dashboard from '../pages/supervisor/Dashboard';
import Configuration from '../pages/settings/Configuration';
import Portal from '../pages/client/Portal';

// Placeholder page for routes not yet implemented
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-hard-hat text-slate-400 text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
          <p className="text-slate-500">{description}</p>
        </div>
      </main>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/portal/:token',
    element: <Portal />,
  },

  // Collector routes
  {
    element: <ProtectedRoute allowedRoles={['collector', 'admin', 'supervisor']} />,
    children: [
      {
        path: '/collector/requests',
        element: <MyRequests />,
      },
      {
        path: '/collector/new-request',
        element: <NewRequest />,
      },
      {
        path: '/collector/debtor-comms',
        element: <DebtorCommunications />,
      },
      {
        path: '/collector/stats',
        element: <PlaceholderPage title="My Stats" description="Collector statistics coming soon" />,
      },
    ],
  },

  // Admin routes
  {
    element: <ProtectedRoute allowedRoles={['admin', 'supervisor']} />,
    children: [
      {
        path: '/admin/queue',
        element: <Queue />,
      },
    ],
  },

  // Supervisor routes
  {
    element: <ProtectedRoute allowedRoles={['supervisor']} />,
    children: [
      {
        path: '/supervisor/dashboard',
        element: <Dashboard />,
      },
    ],
  },

  // Settings (Admin & Supervisor)
  {
    element: <ProtectedRoute allowedRoles={['admin', 'supervisor']} />,
    children: [
      {
        path: '/settings',
        element: <Configuration />,
      },
    ],
  },

  // Redirect root to login or dashboard
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },

  // 404 - redirect to login
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export default router;
