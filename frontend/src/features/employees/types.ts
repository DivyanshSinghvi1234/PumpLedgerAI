export interface Employee {
  id: number;
  uuid: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeCreate {
  full_name: string;
  phone?: string;
  email?: string;
  role: string;
}

export interface EmployeeUpdate {
  full_name?: string;
  phone?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}
