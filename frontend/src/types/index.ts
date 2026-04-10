// Shared TypeScript interfaces used across multiple pages/components

export type TxType = 'INCOME' | 'EXPENSE';

export type RecurFreq = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

export type Category =
  | 'HOUSING' | 'FOOD' | 'TRANSPORTATION' | 'EDUCATION' | 'HEALTHCARE'
  | 'ENTERTAINMENT' | 'SHOPPING' | 'UTILITIES' | 'PERSONAL_CARE' | 'TRAVEL'
  | 'SAVINGS' | 'SALARY' | 'STIPEND' | 'SCHOLARSHIP' | 'FINANCIAL_AID'
  | 'FAMILY_SUPPORT' | 'FREELANCE' | 'OTHER';

export interface Transaction {
  id: string;
  amount: string;
  currency: string;
  type: TxType;
  category: Category;
  description: string | null;
  notes: string | null;
  receipt_url: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: RecurFreq | null;
  recurring_parent_id: string | null;
  is_generated: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  category: Category;
  limit_amount: string;
  currency: string;
  period: 'MONTHLY' | 'WEEKLY';
  reset_day: number;
  is_active: boolean;
  current_spend?: number;
  utilization?: number;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: string;
  saved_amount: string;
  currency: string;
  deadline: string | null;
  is_active: boolean;
}

export interface Job {
  id: string;
  job_name: string;
  employer: string | null;
  hourly_rate: string;
  hours_per_week: string;
  job_type: 'ON_CAMPUS' | 'INTERNSHIP' | 'CO_OP' | 'FREELANCE' | 'OTHER';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  monthly_income: number;
}

export interface AlertItem {
  budget_id: string;
  category: string;
  type: 'BUDGET_EXCEEDED' | 'APPROACHING_LIMIT';
  message: string;
  utilization: number;
}
