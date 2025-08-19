import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, History, User, Calendar, Clock, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface LeaveReminder {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  leaveStartDate: string;
  leaveEndDate: string;
  daysUntil: number;
  reminderType: '7_days' | '3_days' | '1_day';
  sent: boolean;
}

interface ReminderHistory {
  id: string;
  leaveRequestId: string;
  employeeId: string;
  reminderType: string;
  sentAt: string;
  phoneNumber: string;
  message: string;
}

export default function LeaveMonitoring() {
  const { toast } = useToast();

  const { data: upcomingLeaves = [], isLoading: loadingUpcoming, refetch: refetchUpcoming } = useQuery<LeaveReminder[]>({
    queryKey: ["/api/leave-monitoring/upcoming"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: reminderHistory = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery<ReminderHistory[]>({
    queryKey: ["/api/leave-monitoring/history"],
    refetchInterval: 60000, // Refresh every minute
  });

  const sendRemindersMutation = useMutation({
    mutationFn: () => fetch('/api/leave-monitoring/send-reminders', { method: 'POST' }).then(res => res.json()),
    onSuccess: (data) => {
      toast({
        title: "Pengingat Terkirim",
        description: `${data.sent} pengingat berhasil dikirim, ${data.failed} gagal`,
      });
      refetchUpcoming();
      refetchHistory();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal mengirim pengingat cuti",
        variant: "destructive",
      });
    }
  });

  const getReminderTypeText = (type: string) => {
    switch (type) {
      case '7_days': return '7 Hari';
      case '3_days': return '3 Hari';
      case '1_day': return '1 Hari';
      default: return type;
    }
  };

  const getReminderTypeColor = (type: string) => {
    switch (type) {
      case '7_days': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case '3_days': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case '1_day': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Monitoring Cuti</h1>
          <p className="text-muted-foreground">
            Sistem monitoring dan pengingat cuti otomatis via WhatsApp
          </p>
        </div>
        <Button
          onClick={() => sendRemindersMutation.mutate()}
          disabled={sendRemindersMutation.isPending}
          className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          data-testid="button-send-reminders"
        >
          <Send className="w-4 h-4 mr-2" />
          {sendRemindersMutation.isPending ? "Mengirim..." : "Kirim Pengingat"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" />
              Pengingat Mendatang
            </CardTitle>
            <CardDescription>
              Pengingat cuti yang akan dikirim dalam 7, 3, atau 1 hari
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUpcoming ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : upcomingLeaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Tidak ada pengingat cuti mendatang</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingLeaves.map((reminder: LeaveReminder) => (
                  <div key={reminder.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{reminder.employeeName}</span>
                      </div>
                      <Badge className={getReminderTypeColor(reminder.reminderType)}>
                        {getReminderTypeText(reminder.reminderType)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(parseISO(reminder.leaveStartDate), "dd MMM yyyy", { locale: localeId })} - {" "}
                          {format(parseISO(reminder.leaveEndDate), "dd MMM yyyy", { locale: localeId })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{reminder.daysUntil} hari lagi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        <span>{reminder.employeePhone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminder History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-red-600" />
              Riwayat Pengingat
            </CardTitle>
            <CardDescription>
              Daftar pengingat yang telah dikirim via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : reminderHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Belum ada riwayat pengingat</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {reminderHistory.map((history: ReminderHistory) => (
                  <div key={history.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm">Employee ID: {history.employeeId}</span>
                      </div>
                      <Badge className={getReminderTypeColor(history.reminderType)}>
                        {getReminderTypeText(history.reminderType)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {format(parseISO(history.sentAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        <span>{history.phoneNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Sistem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Jadwal Otomatis</h4>
              <p className="text-muted-foreground">
                Sistem akan mengirim pengingat otomatis setiap hari pukul 09:00 WIB
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Jenis Pengingat</h4>
              <div className="space-y-1">
                <Badge className="bg-blue-100 text-blue-800 text-xs">7 Hari sebelum</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">3 Hari sebelum</Badge>
                <Badge className="bg-red-100 text-red-800 text-xs">1 Hari sebelum</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Status Cuti</h4>
              <p className="text-muted-foreground">
                Hanya cuti dengan status "approved" yang akan mendapat pengingat
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}