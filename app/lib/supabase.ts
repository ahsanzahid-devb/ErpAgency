// lib/supabase.ts
export const supabaseUrl: string = "https://zscselzfuhmletplfzfm.supabase.co";
export const supabaseKey: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzY3NlbHpmdWhtbGV0cGxmemZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjIxNDQsImV4cCI6MjA4NzQzODE0NH0.sbkwAcgwXB2bdD7K6aRLrwdflnYMieQOkn1Y1bc2lnQ";

export const supabaseQuery = async (table: string, method = 'GET', body: any = null, queryParams = '') => {
  if (supabaseUrl === "YOUR_SUPABASE_URL" || !supabaseUrl) {
    console.warn("Supabase URL/Key not configured.");
    return { data: [], error: null };
  }

  const url = `${supabaseUrl}/rest/v1/${table}${queryParams ? '?' + queryParams : ''}`;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  
  // YAHAN CACHE: 'NO-STORE' ADD KIYA HAI TAHO NEXT.JS PURANA DATA NA DIKHAYE
  const options: any = { 
    method, 
    headers,
    cache: 'no-store' 
  };
  
  if (body) options.body = JSON.stringify(body);
  
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    if (response.status === 204) return { data: [], error: null };
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Supabase API Error (${table}):`, error);
    return { data: null, error };
  }
};

export const mapProject = (p: any) => ({ ...p, clientId: p.client_id, contractAmount: Number(p.contract_amount), startDate: p.start_date, endDate: p.end_date });
export const mapScope = (s: any) => ({ ...s, projectId: s.project_id, addedContractAmount: Number(s.added_contract_amount), addedDevCost: Number(s.added_dev_cost) });
export const mapPerson = (p: any) => ({ ...p, paymentModel: p.payment_model, monthlySalary: Number(p.monthly_salary) });
export const mapCost = (c: any) => ({ ...c, projectId: c.project_id, personId: c.person_id, fixedAmount: Number(c.fixed_amount) });
export const mapTxn = (t: any) => ({ ...t, projectId: t.project_id, personId: t.person_id, dueDate: t.due_date, amount: Number(t.amount) });