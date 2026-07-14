import api from "@/api/client";
import type { Shift, ShiftStartRequest, ShiftEndRequest, ShiftTimetable, ShiftTimetableCreate, ShiftTimetableUpdate } from "../types";
import type { Employee } from "../../employees/types";

class ShiftService {
  async getActiveShift(): Promise<Shift | null> {
    const response = await api.get<Shift | null>("/v1/shifts/active");
    return response.data;
  }

  async startShift(data: ShiftStartRequest): Promise<Shift> {
    const response = await api.post<Shift>("/v1/shifts/start", data);
    return response.data;
  }

  async endShift(data: ShiftEndRequest): Promise<Shift> {
    const response = await api.post<Shift>("/v1/shifts/end", data);
    return response.data;
  }

  async getShifts(): Promise<Shift[]> {
    const response = await api.get<Shift[]>("/v1/shifts");
    return response.data;
  }

  async getEmployees(): Promise<Employee[]> {
    const response = await api.get<Employee[]>("/v1/employees");
    return response.data;
  }

  async getTimetables(): Promise<ShiftTimetable[]> {
    const response = await api.get<ShiftTimetable[]>("/v1/shifts/timetables");
    return response.data;
  }

  async createTimetable(data: ShiftTimetableCreate): Promise<ShiftTimetable> {
    const response = await api.post<ShiftTimetable>("/v1/shifts/timetables", data);
    return response.data;
  }

  async updateTimetable(uuid: string, data: ShiftTimetableUpdate): Promise<ShiftTimetable> {
    const response = await api.put<ShiftTimetable>(`/v1/shifts/timetables/${uuid}`, data);
    return response.data;
  }

  async deleteTimetable(uuid: string): Promise<void> {
    await api.delete(`/v1/shifts/timetables/${uuid}`);
  }
}

const shiftService = new ShiftService();
export default shiftService;
