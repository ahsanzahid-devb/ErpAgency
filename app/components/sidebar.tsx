// components/Sidebar.tsx
"use client";
import React from 'react';

export default function Sidebar({ activeTab, setActiveTab }: any) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'projects', label: 'Projects & Sales', icon: '📁' },
    { id: 'team', label: 'Team & Payroll', icon: '👥' },
    { id: 'opex', label: 'Office & OpEx', icon: '🏢' },
    { id: 'ledger', label: 'Master Ledger', icon: '💳' },
    { id: 'reports', label: 'Detailed Reports', icon: '📈' },
    { id: 'settings', label: 'Settings / Config', icon: '⚙️' },
  ];

  return (
    <aside className="w-60 bg-[#080d1a] border-r border-white/5 p-4 flex flex-col gap-1 shadow-2xl shrink-0">
      {tabs.map(tab => (
        <button 
          key={tab.id} 
          onClick={() => setActiveTab(tab.id)} 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 border ${activeTab === tab.id ? 'bg-[#0b1221] border-blue-500/30 text-blue-400 font-medium shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}
        >
          <span className="text-lg opacity-80">{tab.icon}</span> {tab.label}
        </button>
      ))}
    </aside>
  );
}