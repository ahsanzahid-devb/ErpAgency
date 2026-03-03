export interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  department: string;
  contract_amount: number;
  start_date: string;
  end_date?: string;
  status: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  type: 'In-House' | 'Remote';
  payment_model: 'Monthly Salary' | 'Fixed Project';
  monthly_salary: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: string;
  project_id?: string;
  person_id?: string;
  category?: string;
  amount: number;
  status: 'Paid' | 'Pending';
  note?: string;
}

export interface TeamCost {
  id: string;
  project_id: string;
  person_id: string;
  fixed_amount: number;
}

export interface ScopeChange {
  id: string;
  project_id: string;
  added_contract_amount: number;
  added_dev_cost: number;
  note?: string;
  created_at?: string;
}
