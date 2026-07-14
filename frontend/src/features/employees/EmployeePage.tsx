import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Mail,
  Phone,
  Briefcase,
  PlusCircle,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import employeeService from "./services/employeeService";
import shiftService from "@/features/shifts/services/shiftService";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "./types";
import type { ShiftTimetable } from "@/features/shifts/types";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function EmployeePage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const queryClient = useQueryClient();

  // Selected employee for Timetable/Book view
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

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

  // Profile forms
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");

  // Queries
  const { data: employees, isLoading: empLoading, isError: empError } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeService.getEmployees(),
  });

  const { data: timetables, isLoading: timetablesLoading } = useQuery({
    queryKey: ["timetables"],
    queryFn: () => shiftService.getTimetables(),
  });

  // Mutations
  const createEmpMutation = useMutation({
    mutationFn: (data: EmployeeCreate) => employeeService.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee profile added successfully!");
      setIsAddEmployeeOpen(false);
      resetEmpForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to create employee profile.";
      toast.error(msg);
    },
  });

  const updateEmpMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: EmployeeUpdate }) =>
      employeeService.updateEmployee(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee profile updated successfully!");
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
      toast.success("Employee profile removed.");
    },
    onError: () => {
      toast.error("Failed to delete employee profile.");
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
    if (!selectedEmp) return;
    createScheduleMutation.mutate({
      employee_uuid: selectedEmp.uuid,
      day_of_week: newSchedDay,
      start_time: newSchedStart,
      end_time: newSchedEnd,
    });
  };

  const handleStartEditSlot = (slot: ShiftTimetable) => {
    setEditingSlot(slot);
    setEditDay(slot.day_of_week);
    setEditStart(slot.start_time);
    setEditEnd(slot.end_time);
  };

  if (empLoading || timetablesLoading) {
    return <LoadingState />;
  }

  if (empError) {
    return <EmptyState message="Unable to load employee list." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Employee Management"
          description="Register employees, configure profile cards, and audit individual weekly shift schedule slots."
        />
        {isAdminOrManager && (
          <Button
            onClick={() => {
              resetEmpForm();
              setIsAddEmployeeOpen(true);
            }}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs py-2 px-4 shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Employee Profile
          </Button>
        )}
      </div>

      <Card className="glass border-hairline">
        <CardHeader className="pb-3 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
              <Users size={15} />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight text-ink">
                Active Staff Directory
              </CardTitle>
              <CardDescription className="text-xs text-ink-subtle">
                Directory roster of registered pump cashiers and station supervisors.
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
                    Employee
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Contact Details
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Staff Designation
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Active Slots
                  </TableHead>
                  <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees && employees.length > 0 ? (
                  employees.map((emp) => {
                    const slots = (timetables ?? []).filter((t) => t.employee.uuid === emp.uuid);
                    return (
                      <TableRow key={emp.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                        <TableCell className="px-5 text-xs font-bold text-ink py-4 flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-fuel-amber/15 text-fuel-amber flex items-center justify-center font-bold text-xs shadow-sm">
                            {emp.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-ink">{emp.full_name}</div>
                            <div className="text-[10px] text-ink-tertiary font-mono font-medium mt-0.5">
                              ID: {emp.uuid.slice(0, 8)}
                            </div>
                          </div>
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
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="bg-surface-3 text-ink-subtle border-hairline text-[10px] font-semibold">
                            <Briefcase size={10} className="mr-1 text-fuel-amber" /> {emp.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-ink-muted">
                          {slots.length} shift slots
                        </TableCell>
                        <TableCell className="px-5 text-right space-x-1.5">
                          <Button
                            onClick={() => setSelectedEmp(emp)}
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
                                title="Delete profile"
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

      {/* Add Employee profile Modal */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink">Add Employee Profile</DialogTitle>
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
                onClick={() => setIsAddEmployeeOpen(false)}
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
              <DialogTitle className="text-base font-bold text-ink">Edit Employee Profile</DialogTitle>
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

      {/* Schedule Book Dialog (Book Icon Click Opens Employee-Specific Shifts menu to Edit/Delete) */}
      <Dialog open={selectedEmp !== null} onOpenChange={() => setSelectedEmp(null)}>
        {selectedEmp && (
          <DialogContent className="glass border border-hairline sm:max-w-[550px]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
                    <BookOpen size={16} className="text-fuel-amber" /> Schedule Book: {selectedEmp.full_name}
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
                    <PlusCircle size={12} /> Add Shift Slot
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
                      const empSlots = (timetables ?? []).filter((t) => t.employee.uuid === selectedEmp.uuid);
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
                onClick={() => setSelectedEmp(null)}
                className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
              >
                Close Book
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* dialog to add shift slot inside employee schedule book */}
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
