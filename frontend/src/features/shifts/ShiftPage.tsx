import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Clock,
  RefreshCw,
  CheckCircle2,
  Lock,
  CalendarDays,
  Plus,
  Trash2,
  Calendar,
  BookOpen,
  UserCheck,
  TrendingUp,
  Edit2,
  Phone,
  Mail,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import shiftService from "./services/shiftService";
import employeeService from "@/features/employees/services/employeeService";
import type { Shift, ShiftTimetable } from "./types";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "@/features/employees/types";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// StatCard component for dashboard summary
function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorClasses = {
    'fuel-amber': 'bg-fuel-amber/10 text-fuel-amber border-fuel-amber/20',
    'success': 'bg-success/10 text-success border-success/20',
    'ink': 'bg-ink/10 text-ink border-ink/20',
  };
  
  return (
    <Card className="glass border-hairline">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-subtle font-medium">{title}</p>
            <p className="text-xl font-bold text-ink mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses] || colorClasses['fuel-amber']}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Timeline chart component for visual daily shift visualization
interface TimelineChartProps {
  timetables: ShiftTimetable[];
  shifts: Shift[];
  todayDayName: string;
}

function ShiftTimelineChart({ timetables, shifts, todayDayName }: TimelineChartProps) {
  // Filter today's scheduled timetables
  const todayTimetables = timetables.filter((t) => t.day_of_week === todayDayName);
  
  // Filter today's actual shifts
  const todayShifts = shifts.filter((s) => {
    const shiftDate = new Date(s.start_time).toDateString();
    const todayDate = new Date().toDateString();
    return shiftDate === todayDate;
  });

  // Time range for the chart: 6 AM to 10 PM (16 hours = 960 minutes)
  const START_HOUR = 6;
  const END_HOUR = 22;
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
  const PIXELS_PER_MINUTE = 2; // Chart width scaling

  // Helper to convert time string (e.g., "06:00 AM") to minutes from start
  const timeToMinutes = (timeStr: string): number => {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let hour24 = hours;
    if (period === "PM" && hours !== 12) hour24 += 12;
    if (period === "AM" && hours === 12) hour24 = 0;
    return (hour24 - START_HOUR) * 60 + minutes;
  };

  // Helper to format minutes back to time
  const minutesToTime = (mins: number): string => {
    const hour = START_HOUR + Math.floor(mins / 60);
    const minute = mins % 60;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  // Current time indicator
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutesFromStart = (currentHour - START_HOUR) * 60 + currentMinute;
  const currentPosition = Math.max(0, Math.min(100, (currentMinutesFromStart / TOTAL_MINUTES) * 100));
  const isCurrentTimeInRange = currentHour >= START_HOUR && currentHour < END_HOUR;

  // Build shift data for each employee
  const employeeMap = new Map<string, { scheduled: Array<{start: number; end: number; label: string}>; actual: Array<{start: number; end: number; label: string; status: string}> }>();

  // Add scheduled shifts
  todayTimetables.forEach((t) => {
    const start = timeToMinutes(t.start_time);
    const end = timeToMinutes(t.end_time);
    const employeeName = t.employee?.full_name || "Unknown";
    if (!employeeMap.has(employeeName)) {
      employeeMap.set(employeeName, { scheduled: [], actual: [] });
    }
    employeeMap.get(employeeName)!.scheduled.push({
      start,
      end,
      label: `${t.start_time} - ${t.end_time}`,
    });
  });

  // Add actual shifts
  todayShifts.forEach((s) => {
    const start = Math.max(0, timeToMinutes(s.start_time));
    const end = s.end_time ? Math.min(TOTAL_MINUTES, timeToMinutes(s.end_time)) : TOTAL_MINUTES;
    const employeeName = s.employee?.full_name || "Unknown";
    if (!employeeMap.has(employeeName)) {
      employeeMap.set(employeeName, { scheduled: [], actual: [] });
    }
    employeeMap.get(employeeName)!.actual.push({
      start,
      end,
      label: s.end_time 
        ? `${new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - ${new Date(s.end_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
        : `${new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - Ongoing`,
      status: s.end_time ? "Completed" : "Active",
    });
  });

  const employees = Array.from(employeeMap.entries());

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-ink-subtle">
        <Clock size={32} className="mx-auto text-ink-tertiary mb-3" />
        <p className="text-sm">No scheduled or active shifts for {todayDayName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time axis header */}
      <div className="flex items-end gap-1 pl-24 relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 border-r border-hairline" />
        {Array.from({ length: (END_HOUR - START_HOUR) + 1 }).map((_, i) => {
          const hour = START_HOUR + i;
          const displayHour = hour % 12 || 12;
          const period = hour >= 12 ? "PM" : "AM";
          return (
            <div
              key={hour}
              className="flex-1 text-[10px] font-mono text-center border-l border-hairline/30 relative"
              style={{ minWidth: `${60 * PIXELS_PER_MINUTE}px` }}
            >
              {i === 0 ? "" : (
                <span className="absolute -top-5 left-0 transform -translate-x-1/2 whitespace-nowrap">
                  {displayHour}{period}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Employee rows */}
      <div className="space-y-3">
        {employees.map(([name, data]) => {
          const isActive = data.actual.some((a) => a.status === "Active");
          const isCompleted = data.actual.some((a) => a.status === "Completed");
          
          return (
            <div
              key={name}
              className={`relative rounded-lg border p-3 transition-all ${
                isActive
                  ? "bg-success/5 border-success/30"
                  : isCompleted
                  ? "bg-surface-2 border-hairline"
                  : "bg-surface-1 border-hairline border-dashed"
              }`}
            >
              {/* Employee name */}
              <div className="flex items-center gap-2 mb-2 pl-24">
                <div className="h-6 w-6 rounded-full bg-fuel-amber/10 text-fuel-amber flex items-center justify-center font-bold text-xs">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-ink">{name}</span>
                <Badge
                  variant="secondary"
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    isActive
                      ? "bg-success/15 text-success"
                      : isCompleted
                      ? "bg-ink-tertiary/10 text-ink-subtle"
                      : "bg-fuel-amber/10 text-fuel-amber"
                  }`}
                >
                  {isActive ? "Active" : isCompleted ? "Completed" : "Scheduled"}
                </Badge>
              </div>

              {/* Timeline bars */}
              <div className="relative h-12 pl-24">
                {/* Track background */}
                <div className="absolute inset-0 bg-surface-1 rounded border border-hairline" />
                
                {/* Current time line */}
                {isCurrentTimeInRange && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-fuel-amber animate-pulse"
                    style={{ left: `${currentPosition}%` }}
                    title={`Current time: ${minutesToTime(currentMinutesFromStart)}`}
                  />
                )}

                {/* Scheduled shifts (lighter, outlined) */}
                {data.scheduled.map((slot, idx) => (
                  <div
                    key={`sched-${idx}`}
                    className="absolute top-1 h-4 bg-fuel-amber/20 border border-fuel-amber/40 rounded cursor-pointer"
                    style={{
                      left: `${(slot.start / TOTAL_MINUTES) * 100}%`,
                      width: `${((slot.end - slot.start) / TOTAL_MINUTES) * 100}%`,
                    }}
                    title={`Scheduled: ${slot.label}`}
                  >
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-fuel-amber/80 whitespace-nowrap">
                      {slot.label}
                    </span>
                  </div>
                ))}

                {/* Actual shifts (solid, colored by status) */}
                {data.actual.map((slot, idx) => (
                  <div
                    key={`actual-${idx}`}
                    className={`absolute top-6 h-5 rounded cursor-pointer ${
                      slot.status === "Active" 
                        ? "bg-success shadow-success/20" 
                        : "bg-ink border border-ink/20"
                    }`}
                    style={{
                      left: `${(slot.start / TOTAL_MINUTES) * 100}%`,
                      width: `${Math.max(2, ((slot.end - slot.start) / TOTAL_MINUTES) * 100)}%`,
                    }}
                    title={`Actual: ${slot.label}`}
                  >
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-white whitespace-nowrap">
                      {slot.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-hairline text-xs text-ink-subtle">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 bg-fuel-amber/20 border border-fuel-amber/40 rounded" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 bg-success rounded" />
          <span>Active Shift</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 bg-ink rounded border border-ink/20" />
          <span>Completed Shift</span>
        </div>
        {isCurrentTimeInRange && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-2 relative">
              <div className="absolute top-0 bottom-0 w-px bg-fuel-amber animate-pulse left-1/2" />
            </div>
            <span>Current Time</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShiftPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"shifts" | "timetables" | "activity">("shifts");

  // Dialog states
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // New employee form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");

  // Shift start form states
  const [employeeName, setEmployeeName] = useState("");
  const [openingCash, setOpeningCash] = useState("");

  // Shift end form states
  const [closingCash, setClosingCash] = useState("");



  // Edit schedule slot state
  const [editingSlot, setEditingSlot] = useState<ShiftTimetable | null>(null);
  const [editDay, setEditDay] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Add new schedule slot for current employee state
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [newSchedDay, setNewSchedDay] = useState("Monday");
  const [newSchedStart, setNewSchedStart] = useState("06:00 AM");
  const [newSchedEnd, setNewSchedEnd] = useState("02:00 PM");

  // Queries
  const { data: activeShift, isLoading: activeLoading } = useQuery({
    queryKey: ["activeShift"],
    queryFn: () => shiftService.getActiveShift(),
  });

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts"],
    queryFn: () => shiftService.getShifts(),
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeService.getEmployees(),
  });

  const { data: timetables = [], isLoading: timetablesLoading } = useQuery({
    queryKey: ["timetables"],
    queryFn: () => shiftService.getTimetables(),
  });

  // Mutations
  const startShiftMutation = useMutation({
    mutationFn: (data: any) => shiftService.startShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeShift"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift session started successfully!");
      setEmployeeName("");
      setOpeningCash("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to start shift session.";
      toast.error(msg);
    },
  });

  const endShiftMutation = useMutation({
    mutationFn: (data: any) => shiftService.endShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeShift"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift session closed and reconciled!");
      setClosingCash("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to close shift session.";
      toast.error(msg);
    },
  });



  const deleteTimetableMutation = useMutation({
    mutationFn: (uuid: string) => shiftService.deleteTimetable(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Timetable slot removed successfully.");
    },
    onError: () => {
      toast.error("Failed to delete timetable slot.");
    },
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: EmployeeCreate) => employeeService.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Employee added successfully!");
      setIsAddEmployeeOpen(false);
      resetEmpForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to create employee.";
      toast.error(msg);
    },
  });

  const updateEmpMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: EmployeeUpdate }) =>
      employeeService.updateEmployee(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Employee updated successfully!");
      setEditingEmp(null);
      resetEmpForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to update employee.";
      toast.error(msg);
    },
  });

  const deleteEmpMutation = useMutation({
    mutationFn: (uuid: string) => employeeService.deleteEmployee(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Employee removed.");
    },
    onError: () => {
      toast.error("Failed to delete employee.");
    },
  });

  // Schedule mutations
  const deleteScheduleMutation = useMutation({
    mutationFn: (uuid: string) => shiftService.deleteTimetable(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Shift slot deleted.");
    },
    onError: () => {
      toast.error("Failed to delete schedule slot.");
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: any }) =>
      shiftService.updateTimetable(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Shift slot updated successfully.");
      setEditingSlot(null);
    },
    onError: () => {
      toast.error("Failed to update schedule slot.");
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => shiftService.createTimetable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      toast.success("Schedule slot added!");
      setIsAddScheduleOpen(false);
    },
    onError: () => {
      toast.error("Failed to add schedule slot.");
    },
  });

  const resetEmpForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setRole("OPERATOR");
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) return;
    createEmpMutation.mutate({
      full_name: fullName,
      phone: phone || undefined,
      email: email || undefined,
      role,
    });
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    updateEmpMutation.mutate({
      uuid: editingEmp.uuid,
      data: {
        full_name: fullName,
        phone: phone || undefined,
        email: email || undefined,
        role,
      },
    });
  };

  const handleStartEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setFullName(emp.full_name);
    setPhone(emp.phone || "");
    setEmail(emp.email || "");
    setRole(emp.role);
  };

  const handleStartEditSlot = (slot: ShiftTimetable) => {
    setEditingSlot(slot);
    setEditDay(slot.day_of_week);
    setEditStart(slot.start_time);
    setEditEnd(slot.end_time);
  };

  const handleUpdateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    updateScheduleMutation.mutate({
      uuid: editingSlot.uuid,
      data: {
        day_of_week: editDay,
        start_time: editStart,
        end_time: editEnd,
      },
    });
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    createScheduleMutation.mutate({
      employee_uuid: selectedEmployee.uuid,
      day_of_week: newSchedDay,
      start_time: newSchedStart,
      end_time: newSchedEnd,
    });
  };

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName || !openingCash) {
      toast.error("Please select an employee and specify opening cash.");
      return;
    }
    // Find employee uuid from name
    const employee = employees.find(emp => emp.full_name === employeeName);
    if (!employee) {
      toast.error("Selected employee not found.");
      return;
    }
    startShiftMutation.mutate({
      employee_uuid: employee.uuid,
      opening_cash: parseFloat(openingCash),
    });
  };

  const handleEndShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingCash) {
      toast.error("Please specify reported closing cash.");
      return;
    }
    endShiftMutation.mutate({
      closing_cash_reported: parseFloat(closingCash),
    });
  };





  if (activeLoading || shiftsLoading || timetablesLoading || employeesLoading) {
    return <LoadingState />;
  }

  // Get current day of week to compute today's live activity
  const todayDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Compute today's active/completed/scheduled shifts
  const getTodayRoster = () => {
    const todayTimetables = (timetables ?? []).filter((t) => t.day_of_week === todayDayName);
    const todayShifts = (shifts ?? []).filter((s) => {
      const shiftDate = new Date(s.start_time).toDateString();
      const todayDate = new Date().toDateString();
      return shiftDate === todayDate;
    });

    const rosterMap = new Map<string, any>();

    // Step 1: Add scheduled slots
    todayTimetables.forEach((t) => {
      const employeeName = t.employee?.full_name || "Unknown";
      rosterMap.set(employeeName, {
        attendant_name: employeeName,
        scheduled: `${t.start_time} - ${t.end_time}`,
        status: "Scheduled",
        start_time: null,
        end_time: null,
        reported_cash: null,
        variance: null,
        sales: 0,
      });
    });

    // Step 2: Overlay actual execution shifts
    todayShifts.forEach((s) => {
      const employeeName = s.employee?.full_name || "Unknown";
      const existing = rosterMap.get(employeeName) || {
        attendant_name: employeeName,
        scheduled: "Ad-hoc (No Rota)",
      };

      rosterMap.set(employeeName, {
        ...existing,
        status: s.end_time ? "Completed" : "Active",
        start_time: s.start_time,
        end_time: s.end_time,
        reported_cash: s.closing_cash_reported,
        variance: s.variance,
        sales: s.total_sales_amount,
      });
    });

    return Array.from(rosterMap.values());
  };

  const todayRoster = getTodayRoster();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift & Handover"
        description="Reconcile employee cashier shift sessions, track cash variances, and manage shift timetables."
      />

      {/* Tabs */}
      <div className="flex border-b border-hairline gap-4">
        <button
          onClick={() => setActiveTab("shifts")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "shifts"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Active Shift & Log
        </button>
        <button
          onClick={() => setActiveTab("timetables")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "timetables"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Employees & Timetables
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "activity"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Live Roster & Activity
        </button>
      </div>

      {activeTab === "shifts" ? (
        <div className="grid gap-8 md:grid-cols-3 animate-fade-in">
          {/* Left column: Shift controller cards */}
          <div className="md:col-span-1 space-y-6">
            {activeShift ? (
              /* Open Shift Panel */
              <Card className="glass border-hairline relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-success" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-success/10 text-success text-[10px] uppercase font-mono font-bold">
                      Active Session
                    </Badge>
                    <Clock size={16} className="text-success animate-pulse" />
                  </div>
                  <CardTitle className="text-base font-bold tracking-tight text-ink mt-2.5 flex items-center gap-2">
                    <Users size={16} className="text-fuel-amber" /> {activeShift.employee?.full_name || "Unknown"}
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-subtle">
                    Started at {new Date(activeShift.start_time).toLocaleTimeString()} on {new Date(activeShift.start_time).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3.5 bg-surface-2 rounded-lg border border-hairline flex justify-between items-center">
                    <span className="text-xs font-semibold text-ink-muted">Opening Cash Box</span>
                    <span className="text-sm font-bold text-ink font-mono">₹{Number(activeShift.opening_cash).toFixed(2)}</span>
                  </div>

                  <form onSubmit={handleEndShift} className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="closingCash" className="text-xs font-semibold text-ink-muted">
                        Reported Cash in Drawer (₹)
                      </Label>
                      <Input
                        id="closingCash"
                        type="number"
                        step="0.01"
                        placeholder="Enter physical cash box total"
                        value={closingCash}
                        onChange={(e) => setClosingCash(e.target.value)}
                        className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-destructive hover:bg-destructive/90 text-canvas font-semibold text-xs py-2 shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Lock size={14} /> Reconcile & Close Shift
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* Closed Shift Panel - Start shift form */
              <Card className="glass border-hairline">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-ink-tertiary/10 text-ink-subtle text-[10px] uppercase font-mono font-bold">
                      No Open Session
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold tracking-tight text-ink mt-2.5 flex items-center gap-2">
                    Open Attendant Shift
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-subtle">
                    Open a new employee cashier session to begin tracking cash reconciliations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleStartShift} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="employeeSelect" className="text-xs font-semibold text-ink-muted">
                        Select Employee
                      </Label>
                      <select
                        id="employeeSelect"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        className="w-full rounded-md border border-hairline bg-surface-2 p-2.5 text-sm text-ink outline-none"
                        required
                      >
                        <option value="">-- Choose Employee --</option>
                        {employees && employees.map((emp) => (
                          <option key={emp.uuid} value={emp.full_name}>
                            {emp.full_name}
                          </option>
                        ))}
                        {!employees && (
                          <>
                            <option value="Ramesh Kumar">Ramesh Kumar</option>
                            <option value="Suresh Kumar">Suresh Kumar</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="openingCash" className="text-xs font-semibold text-ink-muted">
                        Opening Cash Drawer (₹)
                      </Label>
                      <Input
                        id="openingCash"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 2000.00"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(e.target.value)}
                        className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs py-2 shadow-md cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                    >
                      <CheckCircle2 size={14} /> Open Shift Session
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Shift list table */}
          <div className="md:col-span-2 space-y-6">
            <Card className="glass border-hairline">
              <CardHeader className="pb-3 border-b border-hairline">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                    <RefreshCw size={15} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight text-ink">
                      Handover & Reconciliation History
                    </CardTitle>
                    <CardDescription className="text-xs text-ink-subtle">
                      Audit cash handovers and variance reports across cashier shifts.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-hairline hover:bg-transparent">
                        <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                          Attendant
                        </TableHead>
                        <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                          Date / Session
                        </TableHead>
                        <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                          Cash expected
                        </TableHead>
                        <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                          Cash reported
                        </TableHead>
                        <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                          Total Sales
                        </TableHead>
                        <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                          Variance
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts && shifts.length > 0 ? (
                        shifts.map((s) => {
                          const varianceNum = s.variance !== null ? Number(s.variance) : null;
                          const isShortage = varianceNum !== null && varianceNum < 0;
                          return (
                            <TableRow key={s.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                              <TableCell className="px-5 text-xs font-semibold text-ink flex items-center gap-1.5 py-3">
                                <Badge className="bg-surface-3 border-hairline text-ink-subtle text-[10px]">
                                  {s.employee?.full_name || "Unknown"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-medium text-ink-muted">
                                <div>
                                  {new Date(s.start_time).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                                <div className="text-[10px] text-ink-tertiary mt-0.5">
                                  {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {s.end_time && ` - ${new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-medium text-ink">
                                ₹{Number(s.opening_cash).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-ink">
                                {s.closing_cash_reported !== null ? `₹${Number(s.closing_cash_reported).toLocaleString()}` : "Open"}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-ink font-mono text-fuel-amber">
                                ₹{Number(s.total_sales_amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="px-5 text-right">
                                {varianceNum !== null ? (
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                                      varianceNum === 0
                                        ? "bg-success/10 text-success"
                                        : isShortage
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-success/10 text-success"
                                    }`}
                                  >
                                    {varianceNum > 0 ? "+" : ""}
                                    ₹{varianceNum.toFixed(2)}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] font-mono text-ink-tertiary">Active</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="h-28 text-center text-xs text-ink-subtle">
                            No shift handover records logged yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : activeTab === "timetables" ? (
        /* Employees & Timetables Tab */
        <div className="space-y-8 animate-fade-in">
          {/* Employees Directory List */}
          <Card className="glass border-hairline">
            <CardHeader className="pb-3 border-b border-hairline flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
                  <Users size={16} className="text-fuel-amber" /> Employees Directory
                </CardTitle>
                <CardDescription className="text-xs text-ink-subtle">
                  Directory of registered employees. Click the schedule icon to view their assigned rota.
                </CardDescription>
              </div>
              {isAdminOrManager && (
                <Button
                  onClick={() => {
                    resetEmpForm();
                    setIsAddEmployeeOpen(true);
                  }}
                  className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs py-1.5 px-3 shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Add Employee
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Name
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Role
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Contact
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Total Scheduled Slots
                      </TableHead>
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees && employees.length > 0 ? (
                      employees.map((emp) => {
                        const slotsCount = (timetables ?? []).filter((t) => t.employee?.full_name === emp.full_name).length;
                        return (
                          <TableRow key={emp.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                            <TableCell className="px-5 text-xs font-bold text-ink py-3.5 flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-fuel-amber/10 text-fuel-amber flex items-center justify-center font-bold text-[10px]">
                                {emp.full_name.slice(0, 2).toUpperCase()}
                              </div>
                              {emp.full_name}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-ink-muted">
                              <Badge className="bg-surface-3 border-hairline text-ink-subtle text-[10px]">
                                {emp.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted">
                              {emp.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone size={12} className="text-ink-tertiary" /> {emp.phone}
                                </div>
                              )}
                              {emp.email && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Mail size={12} className="text-ink-tertiary" /> {emp.email}
                                </div>
                              )}
                              {!emp.phone && !emp.email && (
                                <span className="text-[10px] text-ink-tertiary italic">No contact info</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink-muted">
                              {slotsCount} shift slots scheduled
                            </TableCell>
                            <TableCell className="px-5 text-right space-x-1.5">
                              <Button
                                onClick={() => setSelectedEmployee(emp)}
                                variant="outline"
                                className="border-hairline hover:bg-surface-3 text-[11px] font-semibold h-7 py-0 px-2 cursor-pointer"
                                title="Open schedule book"
                              >
                                <BookOpen size={12} className="mr-1 text-fuel-amber" /> Book Rota
                              </Button>
                              {isAdminOrManager && (
                                <>
                                  <Button
                                    onClick={() => handleStartEditEmp(emp)}
                                    variant="outline"
                                    className="border-hairline hover:bg-surface-3 hover:text-ink text-[11px] font-semibold h-7 w-7 p-0 cursor-pointer"
                                    title="Edit profile"
                                  >
                                    <Edit2 size={12} />
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to remove employee ${emp.full_name}?`)) {
                                        deleteEmpMutation.mutate(emp.uuid);
                                      }
                                    }}
                                    variant="outline"
                                    className="border-hairline hover:bg-destructive/10 text-destructive h-7 w-7 p-0 cursor-pointer"
                                    title="Delete employee"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-28 text-center text-xs text-ink-subtle">
                          No active employee profiles registered.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Active Weekly Timetable - Compact List Grouped by Day */}
            <div className="md:col-span-2 space-y-6">
              <Card className="glass border-hairline">
                <CardHeader className="pb-3 border-b border-hairline">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                      <Calendar size={15} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold tracking-tight text-ink">
                        Active Weekly Timetable
                      </CardTitle>
                      <CardDescription className="text-xs text-ink-subtle">
                        View current weekly shift assignments grouped by day.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {timetables && timetables.length > 0 ? (
                    (() => {
                      // Group timetables by day of week
                      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                      const grouped = new Map<string, ShiftTimetable[]>();
                      
                      timetables.forEach((slot) => {
                        const day = slot.day_of_week;
                        if (!grouped.has(day)) grouped.set(day, []);
                        grouped.get(day)!.push(slot);
                      });

                      return (
                        <div className="space-y-4">
                          {dayOrder.map((day) => {
                            const daySlots = grouped.get(day);
                            if (!daySlots || daySlots.length === 0) return null;
                            
                            return (
                              <div key={day} className="space-y-2">
                                <div className="flex items-center gap-2 pb-1 border-b border-hairline">
                                  <span className="text-xs font-bold text-ink text-fuel-amber uppercase tracking-wide">{day.slice(0, 3)}</span>
                                  <span className="text-xs text-ink-subtle flex-1 border-b border-dotted border-hairline" />
                                  <Badge variant="secondary" className="bg-fuel-amber/10 text-fuel-amber text-[10px] font-semibold">
                                    {daySlots.length} slot{daySlots.length > 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                <div className="space-y-1.5 pl-2">
                                  {daySlots.map((slot) => (
                                    <div
                                      key={slot.uuid}
                                      className="flex items-center justify-between py-2 px-3 rounded border border-hairline hover:bg-surface-3/35 transition-colors"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-fuel-amber/10 text-fuel-amber flex items-center justify-center font-bold text-xs">
                                          {slot.employee?.full_name?.slice(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-ink">{slot.employee?.full_name || 'Unknown'}</div>
                                          <div className="text-xs font-mono text-ink-muted">
                                            {slot.start_time} - {slot.end_time}
                                          </div>
                                        </div>
                                      </div>
                                      {isAdminOrManager && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            onClick={() => handleStartEditSlot(slot)}
                                            variant="outline"
                                            className="border-hairline hover:bg-surface-3 text-[10px] h-6 w-6 p-0 cursor-pointer"
                                            title="Edit hours"
                                          >
                                            <Edit2 size={10} />
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              if (confirm("Delete this weekly schedule slot?")) {
                                                deleteTimetableMutation.mutate(slot.uuid);
                                              }
                                            }}
                                            variant="outline"
                                            className="border-hairline hover:bg-destructive/10 text-destructive h-6 w-6 p-0 cursor-pointer"
                                            title="Remove slot"
                                          >
                                            <Trash2 size={10} />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 text-xs text-ink-subtle">
                      No shift schedules defined. Set up a rota using the assign form.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
      ) : (
        /* Live Roster & Activity Section (Third Sub-section) */
        <div className="space-y-6 animate-fade-in">
          {/* Visual Daily Timeline Chart */}
          <ShiftTimelineChart
            timetables={timetables}
            shifts={shifts ?? []}
            todayDayName={todayDayName}
          />

          {/* Dashboard Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Scheduled Today"
              value={todayRoster.filter(r => r.status === "Scheduled").length}
              icon={<CalendarDays size={20} className="text-fuel-amber" />}
              color="fuel-amber"
            />
            <StatCard
              title="Active Shifts"
              value={todayRoster.filter(r => r.status === "Active").length}
              icon={<UserCheck size={20} className="text-success" />}
              color="success"
            />
            <StatCard
              title="Completed"
              value={todayRoster.filter(r => r.status === "Completed").length}
              icon={<CheckCircle2 size={20} className="text-ink" />}
              color="ink"
            />
            <StatCard
              title="Today's Sales"
              value={`₹${todayRoster.reduce((sum, r) => sum + (r.sales || 0), 0).toLocaleString()}`}
              icon={<TrendingUp size={20} className="text-fuel-amber" />}
              color="fuel-amber"
            />
          </div>

          {/* Today's Employees List */}
          <Card className="glass border-hairline">
            <CardHeader className="pb-3 border-b border-hairline">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-success/10 text-success">
                    <Clock size={15} className="animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
                      Today's Live Roster & Activity
                    </CardTitle>
                    <CardDescription className="text-xs text-ink-subtle">
                      Real-time status tracking of scheduled hours vs. actual shift check-ins for {todayDayName}.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-success/5 text-success text-[10px] uppercase font-mono font-bold tracking-wide">
                  Live Updates
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Employee
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Scheduled Hours
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Check-in / Check-out
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Sales
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Cash / Variance
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayRoster && todayRoster.length > 0 ? (
                      todayRoster.map((roster) => {
                        const isActive = roster.status === "Active";
                        const isCompleted = roster.status === "Completed";
                        const isScheduled = roster.status === "Scheduled";

                        return (
                          <TableRow
                            key={roster.attendant_name}
                            className={`border-b border-hairline hover:bg-surface-3/35 ${
                              isActive
                                ? "bg-success/5"
                                : isCompleted
                                ? "bg-surface-2"
                                : "bg-surface-1 border-dashed"
                            }`}
                          >
                            <TableCell className="px-5 text-sm font-semibold text-ink py-3 flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-fuel-amber/15 text-fuel-amber flex items-center justify-center font-bold text-xs">
                                {roster.attendant_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-ink">{roster.attendant_name}</div>
                                <div className="text-[10px] text-ink-tertiary">
                                  {roster.scheduled || (isScheduled ? "No rota scheduled" : "Ad-hoc shift")}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink-muted">
                              {roster.scheduled || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="secondary"
                                className={`text-[9px] font-bold uppercase tracking-wider ${
                                  isActive
                                    ? "bg-success/15 text-success"
                                    : isCompleted
                                    ? "bg-ink-tertiary/10 text-ink-subtle"
                                    : "bg-fuel-amber/10 text-fuel-amber"
                                }`}
                              >
                                {roster.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-ink-muted">
                              {isActive && (
                                <span className="flex items-center gap-1 text-success">
                                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                  In: {new Date(roster.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {isCompleted && (
                                <span className="flex items-center gap-1">
                                  In: {new Date(roster.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  <span className="mx-1 text-ink-tertiary">|</span>
                                  Out: {new Date(roster.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {isScheduled && (
                                <span className="text-ink-tertiary">Pending check-in</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-fuel-amber">
                              ₹{Number(roster.sales || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {isCompleted ? (
                                <>
                                  <div className="text-ink">₹{Number(roster.reported_cash || 0).toLocaleString()}</div>
                                  <div className={`text-[10px] ${Number(roster.variance || 0) < 0 ? 'text-destructive' : 'text-success'}`}>
                                    {Number(roster.variance || 0) >= 0 ? '+' : ''}
                                    ₹{Number(roster.variance || 0).toFixed(2)}
                                  </div>
                                </>
                              ) : isActive ? (
                                <span className="text-ink-tertiary">Shift in progress</span>
                              ) : (
                                <span className="text-ink-tertiary">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="h-28 text-center text-xs text-ink-subtle">
                          No scheduled rota shifts or active sessions recorded for today.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule Book Dialog (Book Icon Click Opens Employee-Specific Shifts menu to Edit/Delete) */}
      <Dialog open={selectedEmployee !== null} onOpenChange={() => setSelectedEmployee(null)}>
        {selectedEmployee && (
          <DialogContent className="glass border border-hairline sm:max-w-[550px]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
                    <BookOpen size={16} className="text-fuel-amber" /> Schedule Book: {selectedEmployee.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-ink-subtle">
                    Timetable Rota shifts scheduled for this employee.
                  </DialogDescription>
                </div>
                {isAdminOrManager && (
                  <Button
                    onClick={() => setIsAddScheduleOpen(true)}
                    className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-[10px] h-7 px-2 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Shift Slot
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-hairline overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline bg-surface-2 hover:bg-transparent">
                      <TableHead className="px-4 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                        Day
                      </TableHead>
                      <TableHead className="px-4 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                        Working Hours
                      </TableHead>
                      <TableHead className="px-4 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const empSlots = (timetables ?? []).filter((t) => t.employee?.uuid === selectedEmployee.uuid);
                      return empSlots.length > 0 ? (
                        empSlots.map((slot) => {
                          const isEditingThisSlot = editingSlot?.uuid === slot.uuid;
                          return (
                            <TableRow key={slot.uuid} className="border-b border-hairline hover:bg-transparent">
                              <TableCell className="px-4 text-xs font-bold text-ink py-2.5">
                                {isEditingThisSlot ? (
                                  <select
                                    value={editDay}
                                    onChange={(e) => setEditDay(e.target.value)}
                                    className="rounded border border-hairline bg-surface-2 text-xs p-1 outline-none text-ink"
                                  >
                                    {DAYS_OF_WEEK.map((d) => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </select>
                                ) : (
                                  slot.day_of_week
                                )}
                              </TableCell>
                              <TableCell className="px-4 text-xs text-ink-muted">
                                {isEditingThisSlot ? (
                                  <div className="flex gap-2 items-center">
                                    <select
                                      value={editStart}
                                      onChange={(e) => setEditStart(e.target.value)}
                                      className="rounded border border-hairline bg-surface-2 text-xs p-1 outline-none text-ink"
                                    >
                                      <option value="06:00 AM">06:00 AM</option>
                                      <option value="07:00 AM">07:00 AM</option>
                                      <option value="08:00 AM">08:00 AM</option>
                                      <option value="02:00 PM">02:00 PM</option>
                                      <option value="10:00 PM">10:00 PM</option>
                                    </select>
                                    <span className="text-ink-tertiary">to</span>
                                    <select
                                      value={editEnd}
                                      onChange={(e) => setEditEnd(e.target.value)}
                                      className="rounded border border-hairline bg-surface-2 text-xs p-1 outline-none text-ink"
                                    >
                                      <option value="02:00 PM">02:00 PM</option>
                                      <option value="03:00 PM">03:00 PM</option>
                                      <option value="04:00 PM">04:00 PM</option>
                                      <option value="10:00 PM">10:00 PM</option>
                                      <option value="06:00 AM">06:00 AM</option>
                                    </select>
                                  </div>
                                ) : (
                                  `${slot.start_time} - ${slot.end_time}`
                                )}
                              </TableCell>
                              <TableCell className="px-4 text-right space-x-1">
                                {isEditingThisSlot ? (
                                  <>
                                    <Button
                                      onClick={handleUpdateSchedule}
                                      className="bg-success text-canvas text-[10px] h-6 py-0 px-2 cursor-pointer font-semibold"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => setEditingSlot(null)}
                                      className="bg-surface-3 text-ink text-[10px] h-6 py-0 px-2 cursor-pointer font-semibold border-hairline"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  isAdminOrManager && (
                                    <>
                                      <Button
                                        onClick={() => handleStartEditSlot(slot)}
                                        variant="outline"
                                        className="border-hairline hover:bg-surface-3 text-[10px] h-6 w-6 p-0 cursor-pointer text-ink-subtle"
                                        title="Edit hours"
                                      >
                                        <Edit2 size={10} />
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          if (confirm("Delete this weekly schedule slot?")) {
                                            deleteScheduleMutation.mutate(slot.uuid);
                                          }
                                        }}
                                        variant="outline"
                                        className="border-hairline hover:bg-destructive/10 text-destructive h-6 w-6 p-0 cursor-pointer"
                                        title="Remove slot"
                                      >
                                        <Trash2 size={10} />
                                      </Button>
                                    </>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-ink-subtle py-5">
                            No shift schedules configured for this employee.
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setSelectedEmployee(null)}
                className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
              >
                Close Book
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Add Employee profile Modal */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink">Add Employee</DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Register a new employee profile to begin shift scheduling rota assignments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="addName" className="text-xs font-semibold text-ink-muted">Full Name</Label>
              <Input
                id="addName"
                placeholder="Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addPhone" className="text-xs font-semibold text-ink-muted">Phone Number</Label>
              <Input
                id="addPhone"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addEmail" className="text-xs font-semibold text-ink-muted">Email ID</Label>
              <Input
                id="addEmail"
                type="email"
                placeholder="ramesh@pumpledger.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addRole" className="text-xs font-semibold text-ink-muted">Designation</Label>
              <select
                id="addRole"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2.5 text-sm text-ink outline-none"
              >
                <option value="OPERATOR">Pump Operator</option>
                <option value="MANAGER">Shift Manager</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </div>
            <div className="flex justify-end gap-3.5 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setIsAddEmployeeOpen(false);
                  resetEmpForm();
                }}
                className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-4 shadow-md cursor-pointer"
              >
                Register
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee profile Modal */}
      <Dialog open={editingEmp !== null} onOpenChange={() => setEditingEmp(null)}>
        {editingEmp && (
          <DialogContent className="glass border border-hairline sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-ink">Edit Employee</DialogTitle>
              <DialogDescription className="text-xs text-ink-subtle">
                Update designation or contact card info for this employee.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateEmployee} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="editName" className="text-xs font-semibold text-ink-muted">Full Name</Label>
                <Input
                  id="editName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPhone" className="text-xs font-semibold text-ink-muted">Phone Number</Label>
                <Input
                  id="editPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editEmail" className="text-xs font-semibold text-ink-muted">Email ID</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editRole" className="text-xs font-semibold text-ink-muted">Designation</Label>
                <select
                  id="editRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface-2 p-2.5 text-sm text-ink outline-none"
                >
                  <option value="OPERATOR">Pump Operator</option>
                  <option value="MANAGER">Shift Manager</option>
                  <option value="SUPERVISOR">Supervisor</option>
                </select>
              </div>
              <div className="flex justify-end gap-3.5 pt-2">
                <Button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-4 shadow-md cursor-pointer"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Add shift slot inside employee schedule book */}
      <Dialog open={isAddScheduleOpen} onOpenChange={setIsAddScheduleOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink">Add Timetable Slot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSchedule} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="schedDay" className="text-xs font-semibold text-ink-muted">Day of Week</Label>
              <select
                id="schedDay"
                value={newSchedDay}
                onChange={(e) => setNewSchedDay(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2.5 text-sm text-ink outline-none"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="schedStart" className="text-xs font-semibold text-ink-muted">Start Time</Label>
                <select
                  id="schedStart"
                  value={newSchedStart}
                  onChange={(e) => setNewSchedStart(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
                >
                  <option value="06:00 AM">06:00 AM</option>
                  <option value="07:00 AM">07:00 AM</option>
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="10:00 PM">10:00 PM</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedEnd" className="text-xs font-semibold text-ink-muted">End Time</Label>
                <select
                  id="schedEnd"
                  value={newSchedEnd}
                  onChange={(e) => setNewSchedEnd(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
                >
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="03:00 PM">03:00 PM</option>
                  <option value="04:00 PM">04:00 PM</option>
                  <option value="10:00 PM">10:00 PM</option>
                  <option value="06:00 AM">06:00 AM</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setIsAddScheduleOpen(false)}
                className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-4 shadow-md cursor-pointer"
              >
                Add Slot
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
