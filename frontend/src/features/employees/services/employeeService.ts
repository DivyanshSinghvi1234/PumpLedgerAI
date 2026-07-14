import api from "@/api/client";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "../types";

class EmployeeService {
  async getEmployees(): Promise<Employee[]> {
    const response = await api.get<Employee[]>("/v1/employees");
    return response.data;
  }

  async createEmployee(data: EmployeeCreate): Promise<Employee> {
    const response = await api.post<Employee>("/v1/employees", data);
    return response.data;
  }

  async updateEmployee(uuid: string, data: EmployeeUpdate): Promise<Employee> {
    const response = await api.put<Employee>(`/v1/employees/${uuid}`, data);
    return response.data;
  }

  async deleteEmployee(uuid: string): Promise<void> {
    await api.delete(`/v1/employees/${uuid}`);
  }
}

const employeeService = new EmployeeService();
export default employeeService;
