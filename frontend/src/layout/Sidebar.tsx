import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: string; // Using Material Symbols names like 'dashboard'
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'DASHBOARD',
    icon: 'dashboard',
  },
  {
    to: '/history',
    label: 'ARCHIVE',
    icon: 'archive',
  },
  {
    to: '/settings',
    label: 'SYSTEM_SETTINGS',
    icon: 'settings_applications',
  },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-brand-yellow text-black font-bold flex items-center p-4 transition-colors'
      : 'text-white flex items-center p-4 hover:bg-white hover:text-black transition-colors';

  const displayName = (user?.user_metadata?.name as string | undefined) ?? user?.email?.split('@')[0] ?? 'OPERATOR';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Cyber-Industrial Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r-2 border-white bg-[#0E0E0E] font-label uppercase text-xs transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-white shrink-0">
          <div className="text-white font-bold text-lg font-headline tracking-tighter">DISTRIBUTION_ENGINE</div>
          <div className="text-brand-cyan opacity-70 mt-1">V.02-ALPHA</div>
          <div className="text-white opacity-50 mt-1">[SYS_ID: {user?.id?.slice(0, 8) || '00000000'}]</div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            navigate('/dashboard');
            onClose();
          }}
          className="m-4 p-4 bg-brand-yellow text-black border-2 border-black font-bold flex items-center justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_white] transition-all"
        >
          <span>NEW_DISTRIBUTION</span>
          <span className="material-symbols-outlined ml-2">add</span>
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar border-t-2 border-white">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass} onClick={onClose}>
              {({ isActive }) => (
                <>
                  <span className="material-symbols-outlined mr-3">{item.icon}</span>
                  {item.label}
                  {isActive && <span className="ml-auto">{'<'}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / Status */}
        <div className="p-4 border-t-2 border-white bg-surface-container-lowest shrink-0">
          <div className="flex items-center justify-between text-white mb-4">
            <div className="flex items-center">
              <span className="material-symbols-outlined mr-3 text-brand-cyan">lan</span>
              <span>NETWORK_STATUS</span>
            </div>
            <div className="w-2 h-2 bg-brand-yellow rounded-none animate-pulse"></div>
          </div>
          
          {/* User Signout */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20">
            <div className="flex items-center gap-2 truncate pr-2 opacity-80 hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-sm">person</span>
              <span className="truncate">{displayName}</span>
            </div>
            <button
              onClick={handleSignOut}
              title="TERMINATE_SESSION"
              className="text-white hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined font-bold">power_settings_new</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
