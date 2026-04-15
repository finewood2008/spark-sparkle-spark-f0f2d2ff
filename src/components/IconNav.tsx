import { useAppStore } from '../store/appStore';
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  Settings,
  Flame,
  CalendarClock,
} from 'lucide-react';
import type { TabId } from '../types/spark';

const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'studio', icon: <LayoutDashboard size={18} />, label: '创作' },
  { id: 'schedule', icon: <CalendarClock size={18} />, label: '计划' },
  { id: 'dashboard', icon: <BarChart3 size={18} />, label: '数据' },
  { id: 'memory', icon: <Brain size={18} />, label: '记忆' },
];

export default function IconNav() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="w-14 h-screen bg-spark-surface border-r border-spark-gray-200 flex flex-col items-center py-3 shrink-0">
      {/* Logo */}
      <button
        onClick={() => setActiveTab('studio')}
        className="w-9 h-9 rounded-xl spark-gradient flex items-center justify-center mb-5 spark-shadow"
      >
        <Flame size={18} className="text-primary-foreground" />
      </button>

      {/* Tabs */}
      <div className="flex flex-col gap-1 flex-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={`
                w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5
                transition-all duration-200 relative
                ${isActive
                  ? 'bg-spark-warm text-spark-orange'
                  : 'text-spark-gray-400 hover:bg-spark-gray-100 hover:text-spark-gray-600'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-spark-orange" />
              )}
              {tab.icon}
              <span className="text-[9px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings */}
      <button
        onClick={() => setActiveTab('settings')}
        title="设置"
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          activeTab === 'settings'
            ? 'bg-spark-warm text-spark-orange'
            : 'text-spark-gray-400 hover:bg-spark-gray-100 hover:text-spark-gray-600'
        }`}
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
