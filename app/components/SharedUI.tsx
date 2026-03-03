// components/SharedUI.tsx
"use client";
import React from 'react';

export const money = (n: any) => "Rs " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);

export const Modal = ({ title, onClose, children, widthClass = "max-w-2xl" }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
    <div className={`w-full ${widthClass} rounded-2xl border border-white/10 bg-[#0a0f1c] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8`}>
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0a0f1c] z-10">
        <h3 className="text-xl font-bold text-white uppercase tracking-tighter">{title}</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white transition text-2xl leading-none">&times;</button>
      </div>
      {children}
    </div>
  </div>
);

export const Badge = ({ children, color = "gray" }: any) => {
  const colors: any = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-900/30 text-blue-400 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    purple: "bg-purple-900/30 text-purple-400 border-purple-500/20",
    gray: "bg-white/5 text-white/60 border-white/10",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-medium tracking-wide ${colors[color] || colors.gray}`}>{children}</span>;
};

export const PillProgress = ({ label, value, amount, color }: any) => (
  <div className="flex items-center gap-4 mb-3">
    <span className="w-10 text-[10px] text-white/40 uppercase font-bold">{label}</span>
    <div className="flex-1 border border-white/80 rounded-full p-[3px] bg-[#050810] flex items-center relative h-[24px]">
      <div 
        className={`h-full rounded-full transition-all duration-700 ${color === 'emerald' ? 'bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.6)]'}`} 
        style={{ width: `${Math.max(2, Math.min(value, 100))}%` }}
      />
      <span className={`absolute right-3 text-[10px] font-bold z-10 drop-shadow-md ${color === 'emerald' ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
        {money(amount)} Paid
      </span>
    </div>
  </div>
);