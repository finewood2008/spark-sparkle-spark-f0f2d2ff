import { useAppStore } from '../store/appStore';
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  Settings,
  Flame,
} from 'lucide-react';
import type { TabId } from '../types/spark';

const tabs: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'studio', icon: <LayoutDashboard size={20} />, label: '创作' },
  { id: 'dashboard', icon: <BarChart3 size={20} />, label: '数据' },
  { id: 'memory', icon: <Brain size={20} />, label: '记忆' },
];

export default function SparkSidebar() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="w-[72px] h-screen bg-spark-surface border-r border-spark-gray-200 flex flex-col items-center py-4 shrink-0">
      {/* Logo */}
      <button
        onClick={() => setActiveTab('studio')}
        className="w-10 h-10 rounded-xl spark-gradient flex items-center justify-center mb-6 spark-shadow"
      >
        <Flame size={22} className="text-primary-foreground" />
      </button>

      {/* Tabs */}
      <div className="flex flex-col gap-2 flex-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5
                transition-all duration-200 relative group
                ${isActive
                  ? 'bg-spark-warm text-spark-orange'
                  : 'text-spark-gray-500 hover:bg-spark-gray-100 hover:text-spark-gray-700'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-spark-orange" />
              )}
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings */}
      <div className="mt-auto">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
            activeTab === 'settings'
              ? 'bg-spark-warm text-spark-orange'
              : 'text-spark-gray-400 hover:bg-spark-gray-100 hover:text-spark-gray-600'
          }`}
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
