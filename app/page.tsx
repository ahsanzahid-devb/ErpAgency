// app/page.tsx
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseQuery, mapProject, mapScope, mapPerson, mapCost, mapTxn } from "@/app/lib/supabase";
import { money, Modal, Badge, PillProgress } from "../app/components/SharedUI";
import Sidebar from "../app/components/sidebar";
import { LogOut } from "lucide-react";

export default function App() {
  const router = useRouter();
  const [showLogoutCard, setShowLogoutCard] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  // States with TypeScript 'any[]' type to remove errors
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [scopeChanges, setScopeChanges] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [teamCosts, setTeamCosts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // System Configuration
  const [departments, setDepartments] = useState<string[]>(["Web Development", "SEO", "SaaS & CRM", "Mobile Apps", "Design", "General"]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(["Coworking Rent", "Tools", "Hosting", "Domain", "Utilities", "Marketing", "Other"]);
  const [stages, setStages] = useState<string[]>(["Advance", "Mid", "Final", "Other"]);
  
  // Modal State
  const [modalType, setModalType] = useState<any>(null);
  const [editingEntity, setEditingEntity] = useState<any>(null);
  const [txnPrefill, setTxnPrefill] = useState<any>({});
  const [selectedTxnType, setSelectedTxnType] = useState("Client Payment");
  const [teamFilter, setTeamFilter] = useState("All");

  const handleCloseModal = () => { setModalType(null); setEditingEntity(null); setTxnPrefill({}); };
  const openModal = (type: string, entity: any = null, prefill: any = {}) => {
    handleCloseModal();
    setEditingEntity(entity);
    setTxnPrefill(prefill);
    if (type === "transaction") {
      setSelectedTxnType(prefill.type || (entity ? entity.type : "Client Payment"));
    }
    setModalType(type);
  };

  // =======================================
  // 4. DATABASE INITIALIZATION
  // =======================================
  useEffect(() => {
    const fetchDatabase = async () => {
      setIsLoading(true);
      try {
        const [clientsRes, projectsRes, scopeRes, peopleRes, costsRes, txnsRes] = await Promise.all([
          supabaseQuery('clients', 'GET', null, 'select=*'),
          supabaseQuery('projects', 'GET', null, 'select=*'),
          supabaseQuery('scope_changes', 'GET', null, 'select=*'),
          supabaseQuery('people', 'GET', null, 'select=*'),
          supabaseQuery('project_team_costs', 'GET', null, 'select=*'),
          supabaseQuery('transactions', 'GET', null, 'select=*'),
        ]);

        if (clientsRes.data) setClients(clientsRes.data);
        if (projectsRes.data) setProjects(projectsRes.data.map(mapProject));
        if (scopeRes.data) setScopeChanges(scopeRes.data.map(mapScope));
        if (peopleRes.data) setPeople(peopleRes.data.map(mapPerson));
        if (costsRes.data) setTeamCosts(costsRes.data.map(mapCost));
        if (txnsRes.data) setTransactions(txnsRes.data.map(mapTxn));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDatabase();
  }, []);

  // =======================================
  // 5. LOGIC ENGINE (Calculations)
  // =======================================
  const erpEngine = useMemo(() => {
    const paidTxns = transactions.filter(t => t.status === "Paid");
    
    const clientIncome = paidTxns.filter(t => t.type === "Client Payment").reduce((s, t) => s + t.amount, 0);
    const productIncome = paidTxns.filter(t => t.type === "Product Income").reduce((s, t) => s + t.amount, 0);
    const totalIncome = clientIncome + productIncome;

    const devPaid = paidTxns.filter(t => t.type === "Remote Dev Payment").reduce((s, t) => s + t.amount, 0);
    const projectExpPaid = paidTxns.filter(t => t.type === "Project Expense").reduce((s, t) => s + t.amount, 0);
    const salariesPaid = paidTxns.filter(t => t.type === "Salary Payment").reduce((s, t) => s + t.amount, 0);
    const opExPaid = paidTxns.filter(t => t.type === "Office Expense").reduce((s, t) => s + t.amount, 0);
    const totalExpense = devPaid + projectExpPaid + salariesPaid + opExPaid;

    const unpaidOpEx = transactions.filter(t => t.status === "Pending" && t.type === "Office Expense").reduce((s, t) => s + t.amount, 0);

    const enrichedProjects = projects.map(p => {
      const client = clients.find(c => c.id === p.clientId) || { name: "Unknown" };
      const pTxns = transactions.filter(t => t.projectId === p.id);
      const pScopes = scopeChanges.filter(s => s.projectId === p.id);
      
      const extraContract = pScopes.reduce((s, sc) => s + sc.addedContractAmount, 0);
      const extraDev = pScopes.reduce((s, sc) => s + sc.addedDevCost, 0);
      const finalContract = p.contractAmount + extraContract;

      const received = pTxns.filter(t => t.type === "Client Payment" && t.status === "Paid").reduce((s, t) => s + t.amount, 0);
      
      const assignments = teamCosts.filter(c => c.projectId === p.id).map(c => {
        const person = people.find(pe => pe.id === c.personId) || { name: "Unknown", type: "" };
        const paidToDev = pTxns.filter(t => t.personId === c.personId && t.type === "Remote Dev Payment" && t.status === "Paid").reduce((s, t) => s + t.amount, 0);
        return { ...c, name: person.name, type: person.type, paid: paidToDev, balanceDue: Math.max(c.fixedAmount - paidToDev, 0) };
      });

      const baseDevCost = assignments.reduce((s, a) => s + a.fixedAmount, 0);
      const finalDevCost = baseDevCost + extraDev;
      const totalDevPaid = assignments.reduce((s, a) => s + a.paid, 0);

      const balanceDueClient = Math.max(finalContract - received, 0);

      let paymentStatus = "Unpaid"; let statusColor = "rose";
      if (received >= finalContract && finalContract > 0) { paymentStatus = "Fully Paid"; statusColor = "emerald"; }
      else if (received > 0) { paymentStatus = "Partial"; statusColor = "amber"; }

      return {
        ...p, clientName: client.name,
        finalContractAmount: finalContract, finalDevCost, extraContractAmount: extraContract, extraDevCostAmount: extraDev,
        received, balanceDue: balanceDueClient,
        assignments, totalDevPaid, scopeHistory: pScopes,
        paymentStatus, statusColor,
        clientProgress: finalContract ? (received / finalContract) * 100 : 0,
        devProgress: finalDevCost ? (totalDevPaid / finalDevCost) * 100 : 0
      };
    });

    const enrichedPeople = people.map(person => {
      const pTxns = transactions.filter(t => t.personId === person.id);
      const totalPaidOut = pTxns.filter(t => t.status === "Paid").reduce((s, t) => s + t.amount, 0);
      
      let totalEarned = 0;
      if (person.paymentModel === "Monthly Salary") {
        totalEarned = person.monthlySalary || 0;
      } else {
        totalEarned = teamCosts.filter(c => c.personId === person.id).reduce((s, c) => s + c.fixedAmount, 0);
        const theirScopeCuts = scopeChanges.filter(sc => teamCosts.some(tc => tc.projectId === sc.projectId && tc.personId === person.id)).reduce((s, sc) => s + (sc.addedDevCost || 0), 0);
        totalEarned += theirScopeCuts;
      }
      
      const bonuses = pTxns.filter(t => t.category === "Bonus/Commission" && t.status === "Paid").reduce((s, t) => s + t.amount, 0);
      totalEarned += bonuses;
      
      return { ...person, totalPaidOut, totalEarned, balanceOwed: Math.max(totalEarned - totalPaidOut, 0), history: pTxns };
    });

    return { 
      totalIncome, totalExpense, netCash: totalIncome - totalExpense, 
      clientIncome, productIncome, opExPaid, unpaidOpEx,
      projects: enrichedProjects, clients, people: enrichedPeople,
      receivable: enrichedProjects.reduce((s,p) => s + p.balanceDue, 0),
      payable: enrichedPeople.reduce((s,p) => s + p.balanceOwed, 0)
    };
  }, [clients, projects, people, teamCosts, transactions, scopeChanges]);

  // =======================================
  // 6. REPORTS ENGINE
  // =======================================
  const reportEngine = useMemo(() => {
    const monthlyData: any = {};
    transactions.filter(t => t.status === 'Paid').forEach(t => {
      const month = t.date.substring(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0, net: 0 };
      
      if (['Client Payment', 'Product Income'].includes(t.type)) {
        monthlyData[month].income += t.amount;
        monthlyData[month].net += t.amount;
      } else {
        monthlyData[month].expense += t.amount;
        monthlyData[month].net -= t.amount;
      }
    });

    const sortedMonths = Object.entries(monthlyData).map(([month, data]: any) => ({ month, ...data })).sort((a,b) => b.month.localeCompare(a.month));
    return { monthlySummary: sortedMonths };
  }, [transactions]);

  // =======================================
  // 7. ACTION HANDLERS
  // =======================================
  const handleLogout = () => {
    setShowLogoutCard(false);
    document.cookie = "zapps_auth=; path=/; max-age=0;";
    router.push("/login");
  };

  const deleteEntity = async (type: string, id: string) => {
    if (!window.confirm(`Are you sure you want to delete this record?`)) return;
    try {
      if (type === 'Project') { 
        await supabaseQuery('projects', 'DELETE', null, `id=eq.${id}`);
        setProjects(projects.filter(p => p.id !== id)); 
        setTeamCosts(teamCosts.filter(c => c.projectId !== id)); 
        setScopeChanges(scopeChanges.filter(s => s.projectId !== id)); 
      }
      if (type === 'Person') { 
        await supabaseQuery('people', 'DELETE', null, `id=eq.${id}`);
        setPeople(people.filter(p => p.id !== id)); 
        setTeamCosts(teamCosts.filter(c => c.personId !== id)); 
      }
      if (type === 'Transaction') {
        await supabaseQuery('transactions', 'DELETE', null, `id=eq.${id}`);
        setTransactions(transactions.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error("Error deleting", e);
    }
  };

  const handleSaveTransaction = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dbTxn = {
      date: fd.get("date"), 
      type: selectedTxnType,
      project_id: fd.get("projectId") || null, 
      person_id: fd.get("personId") || null,
      category: fd.get("category") || "", 
      amount: Number(fd.get("amount")),
      status: "Paid", 
      note: fd.get("note") || "",
      stage: "Other"
    };

    const { data, error } = await supabaseQuery('transactions', 'POST', [dbTxn]);
    if (data && data.length > 0 && !error) setTransactions([mapTxn(data[0]), ...transactions]);
    handleCloseModal();
  };

  const handleSaveScopeChange = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dbScope = {
      project_id: fd.get("projectId"), 
      date: new Date().toISOString().split('T')[0],
      added_contract_amount: Number(fd.get("addedContractAmount") || 0), 
      added_dev_cost: Number(fd.get("addedDevCost") || 0), 
      note: fd.get("note"),
    };
    
    const { data, error } = await supabaseQuery('scope_changes', 'POST', [dbScope]);
    if (data && data.length > 0 && !error) setScopeChanges([...scopeChanges, mapScope(data[0])]);
    handleCloseModal();
  };

  const handleSaveProject = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editingEntity;
    
    const dbProject = {
      client_id: fd.get("clientId") || null, 
      name: fd.get("name"),
      department: fd.get("department"), 
      contract_amount: Number(fd.get("contractAmount")),
      start_date: fd.get("startDate"), 
      status: "Active"
    };
    
    let savedProj: any;

    if (isEdit) {
      const { data } = await supabaseQuery('projects', 'PATCH', dbProject, `id=eq.${editingEntity.id}`);
      if (data && data.length > 0) {
        savedProj = data[0];
        setProjects(projects.map(p => p.id === savedProj.id ? mapProject(savedProj) : p));
      }
    } else {
      const { data } = await supabaseQuery('projects', 'POST', [dbProject]);
      if (data && data.length > 0) {
        savedProj = data[0];
        setProjects([...projects, mapProject(savedProj)]);

        const devId = fd.get("developerId");
        const devCost = Number(fd.get("devCost"));
        if (devId && devCost > 0) {
          const dbCost = { project_id: savedProj.id, person_id: devId, fixed_amount: devCost, notes: "Base assignment" };
          const { data: costData } = await supabaseQuery('project_team_costs', 'POST', [dbCost]);
          if(costData && costData.length > 0) setTeamCosts([...teamCosts, mapCost(costData[0])]);
        }
      }
    }
    handleCloseModal();
  };

  const handleSavePerson = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = fd.get("employmentType");
    
    const dbPerson = {
      name: fd.get("name"), role: fd.get("role"), type: type,
      payment_model: type === "In-House" ? "Monthly Salary" : "Fixed Project",
      monthly_salary: Number(fd.get("monthlySalary")) || 0,
      status: "Active"
    };
    
    const { data, error } = await supabaseQuery('people', 'POST', [dbPerson]);
    if (data && data.length > 0 && !error) setPeople([...people, mapPerson(data[0])]);
    handleCloseModal();
  };

  const handleAddSetting = (e: any, setter: any, list: any[]) => {
    e.preventDefault();
    const val = (new FormData(e.currentTarget).get("val") as string).trim();
    if (val && !list.includes(val)) setter([...list, val]);
    e.currentTarget.reset();
  };

  const handleDeleteSetting = (val: string, setter: any, list: any[]) => setter(list.filter(item => item !== val));

  if (isLoading) {
    return <div className="min-h-screen bg-[#050810] text-white flex items-center justify-center">Loading Database...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white flex flex-col font-sans selection:bg-blue-500/30">
      
      {/* HEADER WITH GLOBAL ACTIONS */}
      <header className="border-b border-white/5 bg-[#050810]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs shadow-lg shadow-blue-500/20">OS</div>
          <h1 className="text-xl font-bold tracking-tight">Agency ERP</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => openModal("project")} className="hidden sm:block rounded-lg bg-transparent border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition text-white">
            New Project
          </button>
          <button onClick={() => openModal("transaction", null, { type: "Client Payment" })} className="rounded-lg bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:bg-blue-500 transition hidden sm:flex items-center gap-2">
            Log Entry
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* IMPORTED SIDEBAR */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* MAIN CONTENT */}
        <main className="flex-1 p-8 overflow-y-auto">
          
          {/* ================= DASHBOARD (EXCEL MATCH) ================= */}
          {activeTab === 'dashboard' && (
             <div className="animate-in fade-in space-y-6">
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Business Overview</h2>
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span>Period:</span>
                  <select className="bg-[#0a0f1c] border border-white/10 rounded-md px-2 py-1 outline-none text-white">
                    <option>All Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Income */}
                <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-white/50 mb-2">Income (All Time)</div>
                  <div className="text-3xl font-bold text-emerald-400">{money(erpEngine.totalIncome)}</div>
                </div>
                {/* Expenses */}
                <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-white/50 mb-2">Expenses (All Time)</div>
                  <div className="text-3xl font-bold text-rose-400">{money(erpEngine.totalExpense)}</div>
                </div>
                {/* Net Cash */}
                <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6 shadow-lg">
                  <div className="text-sm text-blue-400/80 mb-2">Net Cash (All Time)</div>
                  <div className="text-3xl font-bold text-white">{money(erpEngine.netCash)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 pt-2">
                {/* Left: Department Sales Performance */}
                <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6 shadow-lg">
                  <h3 className="text-[13px] text-white font-medium mb-6">Department Sales Performance (All Time)</h3>
                  <div className="space-y-6">
                    {departments.map(dep => {
                      const projs = erpEngine.projects.filter(p => p.department === dep);
                      const totalContract = projs.reduce((s, p) => s + p.finalContractAmount, 0);
                      const totalReceived = projs.reduce((s, p) => s + p.received, 0);
                      if (totalContract === 0) return null;
                      return (
                        <div key={dep}>
                          <div className="flex justify-between items-end text-sm mb-2">
                            <span className="text-white text-xs">{dep}</span>
                            <span className="font-bold text-white text-xs">{money(totalContract)}</span>
                          </div>
                          <div className="h-[5px] w-full bg-white/5 rounded-full overflow-hidden mb-1.5">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: `${(totalReceived / totalContract) * 100}%`}}></div>
                          </div>
                          <div className="text-right text-[10px] text-white/40">{money(totalReceived)} received</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Action Required */}
                <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
                  <div className="text-yellow-500 mb-3">
                    <svg className="w-10 h-10 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </div>
                  <h3 className="text-yellow-500 font-bold mb-2 text-[15px]">Action Required (All Time)</h3>
                  <p className="text-[12px] text-white/60 mb-8 max-w-[280px] leading-relaxed">You have pending payables or receivables that need attention in the ledger.</p>

                  <div className="grid grid-cols-2 gap-4 w-full px-2">
                    <div className="bg-[#1a0f14] border border-rose-500/10 rounded-lg p-5 flex flex-col items-center justify-center shadow-inner">
                      <span className="text-[10px] text-rose-400/80 mb-1.5 uppercase tracking-wider">Pending Payables</span>
                      <span className="text-xl font-bold text-rose-500">{money(erpEngine.payable)}</span>
                    </div>
                    <div className="bg-[#1a150f] border border-amber-500/10 rounded-lg p-5 flex flex-col items-center justify-center shadow-inner">
                      <span className="text-[10px] text-yellow-500/80 mb-1.5 uppercase tracking-wider">Client Dues</span>
                      <span className="text-xl font-bold text-yellow-500">{money(erpEngine.receivable)}</span>
                    </div>
                  </div>
                </div>
              </div>

             </div>
          )}

          {/* ================= PROJECTS (PILL UI) ================= */}
          {activeTab === 'projects' && (
            <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Active Projects</h2>
                 <button onClick={() => openModal("project")} className="bg-transparent hover:bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-sm transition font-medium text-white">New Project</button>
              </div>

              <div className="space-y-4">
                {erpEngine.projects.map(p => (
                  <div key={p.id} className="rounded-xl border border-white/5 bg-[#0a0f1c] p-6 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center relative group">
                    
                    {/* ACTION BUTTONS */}
                    <div className="absolute top-4 right-4 hidden lg:flex gap-4 z-10">
                      <div className="flex flex-col items-center">
                        <button onClick={() => openModal("scopeChange", p)} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 p-1.5 rounded-lg text-xs" title="Increase Scope">{'\uD83D\uDCC8'}</button>
                        <span className="text-[10px] text-purple-400">Logs</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button onClick={() => openModal("project", p)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 p-1.5 rounded-lg text-xs" title="Edit">{'\u270F\uFE0F'}</button>
                        <span className="text-[10px] text-blue-400">Edit</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button onClick={() => deleteEntity('Project', p.id)} className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 p-1.5 rounded-lg text-xs" title="Delete">{'\uD83D\uDDD1\uFE0F'}</button>
                        <span className="text-[10px] text-rose-400">Delete</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-white/40">{p.id.substring(0, 6)}</span>
                        <h3 className="font-bold text-lg text-white mr-2">{p.name}</h3>
                        <Badge color="gray">{p.department}</Badge>
                      </div>
                      <div className="lg:hidden flex flex-wrap gap-2 mb-3">
                        <button
                          onClick={() => openModal("scopeChange", p)}
                          className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 border border-purple-500/30 px-3 py-1.5 rounded-md text-xs font-medium"
                          title="Increase Scope"
                        >
                          Logs
                        </button>
                        <button
                          onClick={() => openModal("project", p)}
                          className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 px-3 py-1.5 rounded-md text-xs font-medium"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEntity('Project', p.id)}
                          className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 border border-rose-500/30 px-3 py-1.5 rounded-md text-xs font-medium"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                      
                      <div className="text-sm text-white/50 flex flex-wrap gap-x-4 items-center mb-3">
                        <span>Client: <span className="text-white/80">{p.clientName}</span></span>
                        <span>Contract: <span className="text-white font-bold">{money(p.finalContractAmount)}</span>
                          {p.extraContractAmount > 0 && <span className="text-purple-300 text-xs ml-1 font-normal">(Base {money(p.contractAmount)} + {money(p.extraContractAmount)} extra)</span>}
                        </span>
                      </div>

                      {/* SCOPE HISTORY LOG */}
                      {p.scopeHistory.length > 0 && (
                        <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 mt-3 max-w-xl">
                           <div className="text-[10px] uppercase tracking-wider font-bold text-purple-300 mb-1.5">Scope History (Upsells/Additions):</div>
                           {p.scopeHistory.map((sh: any) => (
                             <div key={sh.id} className="text-[11px] text-purple-200/80 mb-1">
                               <span className="opacity-70">{sh.date} -</span> <span className="font-medium">+Rs {sh.addedContractAmount} (Client), +Rs {sh.addedDevCost} (Dev).</span> <span className="italic">"{sh.note}"</span>
                             </div>
                           ))}
                        </div>
                      )}

                      {/* Pill Progress Bars */}
                      <div className="space-y-4 max-w-xl mt-5">
                         <PillProgress label="Client" value={p.clientProgress} amount={p.received} color="emerald" />
                         {p.finalDevCost > 0 && <PillProgress label="Team" value={p.devProgress} amount={p.totalDevPaid} color="rose" />}
                      </div>
                    </div>

                    {/* Right Side: Financial Actions */}
                    <div className="flex flex-row flex-wrap lg:flex-nowrap items-center gap-6 border-t xl:border-t-0 border-white/5 pt-4 xl:pt-0 w-full xl:w-auto shrink-0 mt-4 xl:mt-0">
                       <div className="flex items-center gap-4">
                         <div className="text-right">
                           <div className="text-[10px] text-white/50 mb-1 uppercase tracking-wider">Client Due</div>
                           <div className="font-bold text-lg text-amber-400 leading-none">{money(p.balanceDue)}</div>
                         </div>
                         <button onClick={() => openModal("transaction", null, { type: "Client Payment", projectId: p.id, amount: p.balanceDue })} disabled={p.balanceDue <= 0} className="bg-transparent hover:bg-emerald-500/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#10b981] border border-[#10b981]/50 px-4 py-1.5 rounded-md text-sm font-medium transition">
                           Receive Payment
                         </button>
                       </div>
                       
                       {p.finalDevCost > 0 && (
                       <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                         <div className="text-right">
                           <div className="text-[10px] text-white/50 mb-1 uppercase tracking-wider">Dev Payable</div>
                           <div className="font-bold text-lg text-rose-400 leading-none">{money(p.finalDevCost - p.totalDevPaid)}</div>
                         </div>
                         <button onClick={() => openModal("transaction", null, { type: "Remote Dev Payment", projectId: p.id, personId: p.assignments[0]?.personId, amount: p.finalDevCost - p.totalDevPaid })} disabled={(p.finalDevCost - p.totalDevPaid) <= 0} className="bg-transparent hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed text-[#f43f5e] border border-[#f43f5e]/50 px-4 py-1.5 rounded-md text-sm font-medium transition">
                           Pay Team
                         </button>
                       </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TEAM ================= */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Team & HR</h2>
                  <p className="text-sm text-white/50">Manage your people, view history, and process payroll.</p>
                </div>
                <button onClick={() => openModal("person")} className="bg-[#1f2937] hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm transition font-medium text-white">Add Person</button>
              </div>

              <div className="flex gap-2 mb-6">
                {['All', 'In-House', 'Remote', 'Vendor'].map(f => (
                  <button key={f} onClick={() => setTeamFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${teamFilter === f ? 'bg-blue-600 text-white' : 'bg-[#1f2937]/50 border border-white/5 text-white/60 hover:bg-white/10'}`}>
                    {f}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {erpEngine.people.filter(p => teamFilter === 'All' || p.type === teamFilter).map(person => (
                  <div key={person.id} className="rounded-xl border border-white/5 bg-[#0a0f1c] p-5 flex flex-col transition-colors hover:border-white/10 relative">
                    
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => deleteEntity('Person', person.id)} className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 p-1.5 rounded-lg text-xs">🗑️</button>
                    </div>

                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg text-white">{person.name}</h3>
                      <Badge color={person.type === "In-House" ? "blue" : "purple"}>{person.type}</Badge>
                    </div>
                    <div className="text-[13px] text-white/50 mb-5">{person.role}</div>

                    <div className="bg-[#050810] border border-white/5 rounded-xl p-4 flex justify-between items-center mb-5 mt-auto">
                      <div>
                        <div className="text-[9px] text-white/40 mb-1.5 uppercase tracking-wider font-semibold">Lifetime Paid</div>
                        <div className="text-sm font-bold text-emerald-500">{money(person.totalPaidOut)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-white/40 mb-1.5 uppercase tracking-wider font-semibold">Pending</div>
                        <div className="text-sm font-bold text-yellow-500">{money(person.balanceOwed)}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <button onClick={() => openModal("personProfile", person)} className="text-blue-500 hover:text-blue-400 text-[13px] font-medium transition flex items-center gap-1">
                        View Log/History →
                      </button>
                      <button onClick={() => openModal("transaction", null, { type: person.type === "In-House" ? "Salary Payment" : "Remote Dev Payment", personId: person.id, amount: person.balanceOwed })} className="bg-transparent hover:bg-white/5 text-white/70 border border-white/10 px-3 py-1.5 rounded-md text-[13px] font-medium transition">
                        Quick Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= MASTER LEDGER ================= */}
          {activeTab === 'ledger' && (
            <div className="animate-in fade-in space-y-6">
              <h2 className="text-2xl font-bold">Master Ledger</h2>
              <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0a0f1c]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-white/50">
                    <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Details</th><th className="px-5 py-3 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3">{t.date}</td>
                        <td className="px-5 py-3">{t.type}</td>
                        <td className="px-5 py-3">{t.note}</td>
                        <td className={`px-5 py-3 text-right font-bold ${t.type.includes('Payment') && t.type !== 'Client Payment' ? 'text-rose-400' : 'text-emerald-400'}`}>{money(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= OFFICE OPEX ================= */}
          {activeTab === 'opex' && (
            <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Office OpEx (Kharcha)</h2>
                 <button onClick={() => openModal("transaction", null, { type: "Office Expense" })} className="bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/30 text-orange-400 px-4 py-2 rounded-lg text-sm transition font-medium">Log Expense</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0a0f1c]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-white/50">
                    <tr><th className="px-5 py-3">Txn ID</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Description/Notes</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.filter(t => t.type === 'Office Expense').map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3 text-white/50">{t.id?.substring(0, 8)}</td>
                        <td className="px-5 py-3">{t.date}</td>
                        <td className="px-5 py-3 font-medium text-white/80">{t.category || 'General'}</td>
                        <td className="px-5 py-3">{t.note || '—'}</td>
                        <td className="px-5 py-3"><Badge color={t.status === 'Paid' ? 'emerald' : 'amber'}>{t.status}</Badge></td>
                        <td className="px-5 py-3 text-right font-bold text-orange-400">{money(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= DETAILED REPORTS ================= */}
          {activeTab === 'reports' && (
            <div className="animate-in fade-in space-y-8">
              <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Detailed Financial Reports</h2>
              </div>

              {/* Monthly Summary Table */}
              <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-white">Monthly Cash Summary</h3>
                <div className="overflow-x-auto border border-white/10 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-white/50">
                      <tr>
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3 text-right">Total Income</th>
                        <th className="px-4 py-3 text-right">Total Expenses</th>
                        <th className="px-4 py-3 text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {reportEngine.monthlySummary.map((m: any) => (
                        <tr key={m.month} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium">{m.month}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{money(m.income)}</td>
                          <td className="px-4 py-3 text-right text-rose-400">{money(m.expense)}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-400">{money(m.net)}</td>
                        </tr>
                      ))}
                      {reportEngine.monthlySummary.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-6 text-white/40">No data available yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================= SYSTEM & CONFIG ================= */}
          {activeTab === 'settings' && (
            <div className="animate-in fade-in space-y-6">
              <h2 className="text-2xl font-bold">System Configuration</h2>
              <p className="text-sm text-white/50 mb-6">Manage dropdown lists and default system settings.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Departments Config */}
                 <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-5">
                   <h3 className="font-bold text-lg mb-4 text-blue-400">Departments</h3>
                   <form onSubmit={(e) => handleAddSetting(e, setDepartments, departments)} className="flex gap-2 mb-4">
                     <input required name="val" type="text" placeholder="Add department..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                     <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-bold transition">+</button>
                   </form>
                   <ul className="space-y-2">
                     {departments.map(d => (
                       <li key={d} className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 rounded-lg text-sm group">
                         {d} <button onClick={() => handleDeleteSetting(d, setDepartments, departments)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                       </li>
                     ))}
                   </ul>
                 </div>

                 {/* Expense Categories Config */}
                 <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-5">
                   <h3 className="font-bold text-lg mb-4 text-orange-400">Expense Categories</h3>
                   <form onSubmit={(e) => handleAddSetting(e, setExpenseCategories, expenseCategories)} className="flex gap-2 mb-4">
                     <input required name="val" type="text" placeholder="Add category..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                     <button type="submit" className="bg-orange-600 hover:bg-orange-500 px-3 py-2 rounded-lg text-sm font-bold transition">+</button>
                   </form>
                   <ul className="space-y-2">
                     {expenseCategories.map(c => (
                       <li key={c} className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 rounded-lg text-sm group">
                         {c} <button onClick={() => handleDeleteSetting(c, setExpenseCategories, expenseCategories)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                       </li>
                     ))}
                   </ul>
                 </div>

                 {/* Stages Config */}
                 <div className="bg-[#0a0f1c] border border-white/5 rounded-xl p-5">
                   <h3 className="font-bold text-lg mb-4 text-emerald-400">Payment Stages</h3>
                   <form onSubmit={(e) => handleAddSetting(e, setStages, stages)} className="flex gap-2 mb-4">
                     <input required name="val" type="text" placeholder="Add stage..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                     <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg text-sm font-bold transition">+</button>
                   </form>
                   <ul className="space-y-2">
                     {stages.map(s => (
                       <li key={s} className="flex justify-between items-center bg-black/40 border border-white/5 px-3 py-2 rounded-lg text-sm group">
                         {s} <button onClick={() => handleDeleteSetting(s, setStages, stages)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                       </li>
                     ))}
                   </ul>
                 </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Floating logout control */}
      <div className="fixed bottom-5 right-5 z-50">
        {showLogoutCard && (
          <div className="mb-3 w-64 rounded-xl border border-white/10 bg-[#0a0f1c]/95 text-white shadow-2xl backdrop-blur px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 flex items-center justify-center">
                <LogOut className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold">Sign out</p>
                <p className="text-xs text-white/60">You’ll return to the login screen.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutCard(false)}
                className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-500/25"
              >
                Log out
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowLogoutCard((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-rose-600 text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-rose-500/25 hover:bg-rose-500 transition focus:outline-none focus:ring-4 focus:ring-rose-400/40"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </div>

      {/* =========================================
         MODALS (Forms & History)
      ========================================= */}
      
      {/* View History Log Modal */}
      {modalType === "personProfile" && editingEntity && (
        <Modal title={`${editingEntity.name}'s Financial History`} widthClass="max-w-4xl" onClose={handleCloseModal}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Total Earned</div>
                <div className="font-semibold text-white text-xl">{money(editingEntity.totalEarned)}</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="text-xs text-emerald-200/70 mb-1 uppercase tracking-wider">Amount Paid</div>
                <div className="font-bold text-xl text-emerald-400">{money(editingEntity.totalPaidOut)}</div>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                <div className="text-xs text-rose-200/70 mb-1 uppercase tracking-wider">Balance Due</div>
                <div className="font-bold text-xl text-rose-400">{money(editingEntity.balanceOwed)}</div>
              </div>
            </div>

            <div className="flex gap-3 border-b border-white/10 pb-6">
              <button onClick={() => openModal("transaction", null, { type: 'Salary Payment', personId: editingEntity.id, category: "Bonus/Commission", note: "Bonus / Gift" })} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
                🎁 Give Bonus / Gift
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">Past Payments</h4>
              <div className="overflow-x-auto border border-white/5 rounded-xl bg-[#050810]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-white/50 border-b border-white/5">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Details</th><th className="px-4 py-3 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {editingEntity.history.map((t: any) => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-white/70">{t.date}</td>
                        <td className="px-4 py-3"><Badge color={t.category === 'Bonus/Commission' ? 'purple' : 'gray'}>{t.category === 'Bonus/Commission' ? 'Bonus / Gift' : t.type}</Badge></td>
                        <td className="px-4 py-3 text-white/80">{t.note || "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">{money(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Scope Change Form Modal */}
      {modalType === "scopeChange" && editingEntity && (
        <Modal title={`Increase Scope: ${editingEntity.name}`} onClose={handleCloseModal}>
          <form onSubmit={handleSaveScopeChange} className="space-y-4">
            <input type="hidden" name="projectId" value={editingEntity.id} />
            <div className="bg-purple-900/10 border border-purple-500/20 p-4 rounded-xl mb-4">
              <p className="text-xs text-purple-200/70">Add additional work to this project. This will automatically update both the client's bill and developer's cost.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Add to Client Contract (PKR)</label>
                <input name="addedContractAmount" type="number" min="0" placeholder="50000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Add to Dev Cost (PKR)</label>
                <input name="addedDevCost" type="number" min="0" placeholder="20000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Details of Work *</label>
              <input required name="note" type="text" placeholder="e.g. Built 3 extra pages" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none" />
            </div>
            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg px-4 py-3 transition mt-4">Save Changes</button>
          </form>
        </Modal>
      )}

      {/* SEGMENTED TRANSACTION MODAL */}
      {modalType === "transaction" && (
        <Modal title="Log New Entry" onClose={handleCloseModal}>
          <form onSubmit={handleSaveTransaction} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Select Type *</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div onClick={() => setSelectedTxnType("Client Payment")} className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer transition text-center ${selectedTxnType === 'Client Payment' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#0a0f1c] border-white/10 text-white/50'}`}>
                   <span className="font-bold text-lg mb-0.5">↓ Receive</span>
                   <span className="text-[10px] uppercase tracking-wider opacity-70">Client Payment</span>
                </div>
                <div onClick={() => setSelectedTxnType("Remote Dev Payment")} className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer transition text-center ${selectedTxnType === 'Remote Dev Payment' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'bg-[#0a0f1c] border-white/10 text-white/50'}`}>
                   <span className="font-bold text-lg mb-0.5">↑ Pay Team</span>
                   <span className="text-[10px] uppercase tracking-wider opacity-70">Dev Payment</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div onClick={() => setSelectedTxnType("Salary Payment")} className={`py-2 rounded-lg border cursor-pointer transition text-center ${selectedTxnType === 'Salary Payment' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-[#0a0f1c] border-white/10 text-white/50'}`}>
                   <span className="font-bold text-[11px] uppercase tracking-wider">Pay Salary</span>
                </div>
                <div onClick={() => setSelectedTxnType("Office Expense")} className={`py-2 rounded-lg border cursor-pointer transition text-center ${selectedTxnType === 'Office Expense' ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-[#0a0f1c] border-white/10 text-white/50'}`}>
                   <span className="font-bold text-[11px] uppercase tracking-wider">Office Expense</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Amount (PKR) *</label>
                <input required name="amount" type="number" min="1" defaultValue={txnPrefill.amount || ""} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-lg font-bold outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Date *</label>
                <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none [color-scheme:dark]" />
              </div>
            </div>

            {['Client Payment', 'Remote Dev Payment'].includes(selectedTxnType) && (
              <div className="grid grid-cols-2 gap-4">
                <div className={txnPrefill.projectId ? "opacity-50 pointer-events-none" : ""}>
                  <label className="block text-xs font-medium text-white/50 mb-1">Link to Project</label>
                  <select name="projectId" defaultValue={txnPrefill.projectId || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none">
                    <option value="">-- None --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {selectedTxnType === 'Remote Dev Payment' && (
                  <div className={txnPrefill.personId ? "opacity-50 pointer-events-none" : ""}>
                    <label className="block text-xs font-medium text-white/50 mb-1">Developer Name</label>
                    <select name="personId" defaultValue={txnPrefill.personId || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none">
                      <option value="">-- None --</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            
            {txnPrefill.category && <input type="hidden" name="category" value={txnPrefill.category} />}

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Note / Details</label>
              <input name="note" type="text" defaultValue={txnPrefill.note || ""} placeholder="e.g. Advance payment" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none" />
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg px-4 py-3 mt-4 transition">Save to Ledger</button>
          </form>
        </Modal>
      )}

      {/* Basic Modals for New Project/Person */}
      {modalType === "project" && (
        <Modal title={editingEntity ? "Edit Project" : "Create New Project"} onClose={handleCloseModal}>
           <form onSubmit={handleSaveProject} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Project Name *</label>
              <input required name="name" type="text" defaultValue={editingEntity?.name || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Client Name *</label>
                <select required name="clientId" defaultValue={editingEntity?.clientId || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition">
                  <option value="">Select Client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Department *</label>
                <select required name="department" defaultValue={editingEntity?.department || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition">
                  <option value="">Select Dept...</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Base Contract Amount (PKR) *</label>
                <input required name="contractAmount" type="number" min="0" defaultValue={editingEntity?.contractAmount || ""} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Start Date *</label>
                <input required name="startDate" type="date" defaultValue={editingEntity?.startDate || new Date().toISOString().split('T')[0]} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition [color-scheme:dark]" />
              </div>
            </div>

            {!editingEntity && (
              <div className="mt-6 pt-5 border-t border-white/5">
                <h4 className="text-[13px] font-semibold text-blue-400 mb-4">Base Development Cost & Team (Optional)</h4>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Assign Developer</label>
                    <select name="developerId" className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition">
                      <option value="">-- No Assignment --</option>
                      {people.filter(p => p.type !== 'In-House').map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Base Fixed Dev Cost (PKR)</label>
                    <input name="devCost" type="number" min="0" placeholder="e.g. 80000" className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition" />
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-4 py-3 mt-4 transition">Save Project Portfolio</button>
          </form>
        </Modal>
      )}
      
      {modalType === "person" && (
        <Modal title="Add Team Member / Vendor" onClose={handleCloseModal}>
           <form className="space-y-5" onSubmit={handleSavePerson}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Full Name *</label>
                <input required name="name" type="text" autoFocus className="w-full bg-[#0a0f1c] border border-blue-500/50 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition shadow-[0_0_10px_rgba(59,130,246,0.1)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Role / Title *</label>
                <input required name="role" type="text" placeholder="e.g. Developer" className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Employment Type *</label>
                <select required name="employmentType" className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition">
                  <option value="In-House">In-House (Fixed Salary)</option>
                  <option value="Remote">Remote / Contractor</option>
                  <option value="Vendor">Vendor / Agency</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Monthly Salary (If In-House)</label>
                <input name="monthlySalary" type="number" min="0" defaultValue={0} className="w-full bg-[#0a0f1c] border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 transition" />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-4 py-3 mt-4 transition">Add Record</button>
          </form>
        </Modal>
      )}

    </div>
  );
}

