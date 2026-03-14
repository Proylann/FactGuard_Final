import {
  Activity,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react';
import { secondaryButtonClass } from './shared';

export type AdminView = 'dashboard' | 'users' | 'records' | 'reports' | 'activity';

const NAV_SECTIONS: Array<{
  heading: string;
  items: Array<{
    id: AdminView;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }>;
}> = [
  {
    heading: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    heading: 'Management',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'records', label: 'Records', icon: Activity },
      { id: 'reports', label: 'Reports', icon: FileBarChart },
      { id: 'activity', label: 'Activity Log', icon: ScrollText },
    ],
  },
];

const Sidebar = ({
  currentView,
  onChangeView,
  adminName,
  onLogout,
}: {
  currentView: AdminView;
  onChangeView: (view: AdminView) => void;
  adminName: string;
  onLogout: () => void;
}) => (
  <aside className="flex h-full flex-col rounded-[28px] border-r border-slate-200 bg-slate-50 p-4 md:p-5">
    {/* Brand */}
    <div className="border-b border-slate-200 px-2 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Shield size={20} />
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-slate-900">FactGuard</p>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Admin Control</p>
        </div>
      </div>
    </div>

    {/* Navigation Sections */}
    <nav className="mt-3 flex-1 space-y-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="mb-2 px-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            {section.heading}
          </p>
          <div className="space-y-1.5">
            {section.items.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeView(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                      isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <item.icon size={16} />
                  </span>
                  {item.label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    {/* Footer */}
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
          {adminName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{adminName}</p>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Administrator</p>
        </div>
      </div>
      <button onClick={onLogout} className={`${secondaryButtonClass} w-full`}>
        <LogOut size={16} />
        Logout
      </button>
    </div>
  </aside>
);

export default Sidebar;
