import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRosterSchema } from "@shared/schema";
import type { Employee, RosterSchedule, AttendanceRecord, InsertRosterSchedule } from "@shared/schema";
import { Plus, Calendar, Users, CheckCircle, Clock } from "lucide-react";
import { z } from "zod";

const formSchema = insertRosterSchema;

export default function Roster() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: rosterSchedules = [], isLoading: isLoadingRoster } = useQuery<RosterSchedule[]>({
    queryKey: ["/api/roster", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/roster?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch roster');
      return response.json();
    },
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      date: selectedDate,
      shift: "",
      startTime: "",
      endTime: "",
      status: "scheduled",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertRosterSchedule) => apiRequest("POST", "/api/roster", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Berhasil",
        description: "Roster berhasil ditambahkan",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Gagal menambahkan roster",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      ...values,
      date: selectedDate,
    });
  };

  const getEmployeeName = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)?.name || 'Unknown';
  };

  const getAttendanceStatus = (employeeId: string) => {
    const attendanceRecord = attendance.find(att => att.employeeId === employeeId);
    return attendanceRecord ? {
      status: 'present',
      time: attendanceRecord.time
    } : { status: 'absent', time: null };
  };

  const rosterWithAttendance = rosterSchedules.map(roster => ({
    ...roster,
    employee: employees.find(emp => emp.id === roster.employeeId),
    attendance: getAttendanceStatus(roster.employeeId)
  }));

  const stats = {
    scheduled: rosterSchedules.length,
    present: attendance.length,
    absent: rosterSchedules.length - attendance.length,
    onLeave: 0 // This would need to be calculated from leave data
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Roster Kerja</CardTitle>
          <div className="flex space-x-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
              data-testid="roster-date-input"
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-roster-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Roster
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Tambah Roster</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Karyawan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="roster-employee-select">
                                <SelectValue placeholder="Pilih karyawan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.id} - {employee.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shift"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="roster-shift-select">
                                <SelectValue placeholder="Pilih shift" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Shift 1">Shift 1 (06:00 - 18:00)</SelectItem>
                              <SelectItem value="Shift 2">Shift 2 (18:00 - 06:00)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Mulai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="roster-start-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jam Selesai</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                {...field} 
                                data-testid="roster-end-time-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createMutation.isPending}
                      data-testid="submit-roster-button"
                    >
                      {createMutation.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Roster Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="stats-scheduled">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.scheduled}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Dijadwalkan</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg" data-testid="stats-present">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <p className="text-2xl font-semibold text-green-600 dark:text-green-300">{stats.present}</p>
            <p className="text-sm text-green-600 dark:text-green-400">Hadir</p>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900 rounded-lg" data-testid="stats-absent">
            <Clock className="w-6 h-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <p className="text-2xl font-semibold text-red-600 dark:text-red-300">{stats.absent}</p>
            <p className="text-sm text-red-600 dark:text-red-400">Belum Hadir</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg" data-testid="stats-leave">
            <Users className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <p className="text-2xl font-semibold text-purple-600 dark:text-purple-300">{stats.onLeave}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400">Cuti</p>
          </div>
        </div>
        
        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Nama</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Shift</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Jam Kerja</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Jam Absensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingRoster ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rosterWithAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada roster untuk tanggal ini
                  </td>
                </tr>
              ) : (
                rosterWithAttendance.map((roster) => (
                  <tr key={roster.id} data-testid={`roster-row-${roster.employeeId}`}>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employeeId}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.employee?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.shift}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.startTime} - {roster.endTime}
                    </td>
                    <td className="py-3 px-4">
                      <Badge 
                        className={roster.attendance.status === 'present' ? 'status-present' : 'status-absent'}
                      >
                        {roster.attendance.status === 'present' ? 'Hadir' : 'Belum Hadir'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {roster.attendance.time || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
