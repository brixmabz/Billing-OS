import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  showSecondaryNav?: boolean;
}

export default function Navbar({ showSecondaryNav = true }: NavbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'collector':
        return 'bg-emerald-600';
      case 'admin':
        return 'bg-violet-600';
      case 'supervisor':
        return 'bg-slate-600';
      default:
        return 'bg-blue-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'collector':
        return 'Collector';
      case 'admin':
        return 'Client Services';
      case 'supervisor':
        return 'General Manager';
      default:
        return role;
    }
  };

  const collectorNavItems = [
    { path: '/collector/requests', label: 'My Requests', icon: 'fa-list-check' },
    { path: '/collector/new-request', label: 'New Request', icon: 'fa-plus-circle' },
    { path: '/collector/debtor-comms', label: 'Debtor Comms', icon: 'fa-envelope' },
    { path: '/collector/stats', label: 'My Stats', icon: 'fa-chart-simple' },
  ];

  const adminNavItems = [
    { path: '/admin/queue', label: 'Request Queue', icon: 'fa-inbox' },
    { path: '/settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const supervisorNavItems = [
    { path: '/supervisor/dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { path: '/admin/queue', label: 'Request Queue', icon: 'fa-inbox' },
    { path: '/settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const getNavItems = () => {
    switch (user?.role) {
      case 'collector':
        return collectorNavItems;
      case 'admin':
        return adminNavItems;
      case 'supervisor':
        return supervisorNavItems;
      default:
        return [];
    }
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-bolt text-white text-sm"></i>
            </div>
            <span className="font-bold text-lg">Billing Request OS</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <i className="fas fa-bell"></i>
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center animate-bounce">
              3
            </span>
          </button>
          {/* User Menu */}
          {user && (
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-700">
              <div
                className={`w-8 h-8 ${getRoleColor(user.role)} rounded-full flex items-center justify-center`}
              >
                <span className="text-sm font-medium">{getInitials(user.name)}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-slate-500">
                  {user.team ? `${user.team} • ` : ''}{getRoleLabel(user.role)}
                </p>
              </div>
              <button
                onClick={() => logout()}
                className="text-slate-400 hover:text-white ml-2"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt text-sm"></i>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Secondary Nav */}
      {showSecondaryNav && (
        <div className="bg-white border-b border-slate-200 pt-14">
          <div className="max-w-7xl mx-auto px-6">
            <nav className="flex space-x-6">
              {getNavItems().map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`py-4 border-b-2 font-medium text-sm ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <i className={`fas ${item.icon} mr-2`}></i>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
