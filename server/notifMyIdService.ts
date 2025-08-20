import fetch from 'node-fetch';
import type { Employee } from '@shared/schema';

const NOTIF_API_KEY = process.env.NOTIF_API_KEY;
const API_URL = "https://app.notif.my.id/api/v2/send-message";

interface IncidentData {
  incidentType: string;
  location: string;
  description: string;
  currentStatus: string;
  instructions: string;
  mediaPath?: string | null;
}

interface BlastResult {
  employeeId: string;
  employeeName: string;
  phoneNumber: string;
  status: 'terkirim' | 'gagal';
  errorMessage?: string;
  sentAt?: string;
}

export class NotifMyIdService {
  /**
   * Format pesan WhatsApp untuk notifikasi insiden
   */
  private formatIncidentMessage(incident: IncidentData): string {
    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `⚠️ [Notifikasi Insiden]

Jenis: ${incident.incidentType}
Waktu: ${timestamp}
Lokasi: ${incident.location}

Deskripsi:
${incident.description}

Status Terkini:
${incident.currentStatus}

Instruksi untuk Karyawan:
${incident.instructions}

---
Harap segera mengikuti instruksi di atas dan laporkan status Anda kepada atasan langsung.

Terima kasih atas perhatian dan kerjasamanya.`;
  }

  /**
   * Format nomor telepon untuk notif.my.id v2
   * Berdasarkan contoh: receiver: "120363043283436111@g.us" - bisa individual (@c.us) atau group (@g.us)
   */
  private formatPhoneNumber(phone: string): string {
    // Hapus semua karakter non-digit
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Jika dimulai dengan 0, ganti dengan 62
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }
    
    // Jika belum dimulai dengan 62, tambahkan 62
    if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }
    
    // Return dengan @c.us untuk individual WhatsApp ID
    return cleanPhone + '@c.us';
  }

  /**
   * Kirim pesan WhatsApp ke satu karyawan menggunakan notif.my.id
   */
  private async sendWhatsAppToEmployee(
    employee: Employee,
    message: string,
    mediaUrl?: string
  ): Promise<BlastResult> {
    if (!NOTIF_API_KEY) {
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        phoneNumber: employee.phone,
        status: 'gagal',
        errorMessage: 'NOTIF_API_KEY tidak tersedia',
      };
    }

    const formattedPhone = this.formatPhoneNumber(employee.phone);
    const timestamp = new Date().toISOString();

    try {
      // Format payload sesuai dokumentasi notif.my.id v2
      const payload: any = {
        apikey: NOTIF_API_KEY!,
        receiver: formattedPhone,
        mtype: mediaUrl ? "image" : "text",
        text: message
      };

      // Tambahkan URL media jika ada
      if (mediaUrl) {
        payload.url = mediaUrl;
      }

      console.log(`Sending WhatsApp to ${employee.name} (${formattedPhone})...`);
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Response mungkin HTML atau text, bukan JSON
      const responseText = await response.text();
      let result: any;
      
      try {
        result = JSON.parse(responseText);
      } catch {
        // Jika bukan JSON, gunakan text response
        result = { message: responseText, status: 'error' };
      }
      
      if (response.ok && (result.status === 'success' || result.success === true)) {
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          phoneNumber: employee.phone,
          status: 'terkirim',
          sentAt: timestamp,
        };
      } else {
        // Jika nomor WhatsApp tidak terdaftar
        if (responseText.includes('is not registered on Whatsapp')) {
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            phoneNumber: employee.phone,
            status: 'gagal',
            errorMessage: `Nomor WhatsApp tidak terdaftar: ${formattedPhone}`,
          };
        }
        
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          phoneNumber: employee.phone,
          status: 'gagal',
          errorMessage: result.message || 'Gagal mengirim pesan',
        };
      }
    } catch (error) {
      console.error(`Error sending WhatsApp to ${employee.name}:`, error);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        phoneNumber: employee.phone,
        status: 'gagal',
        errorMessage: error instanceof Error ? error.message : 'Unexpected error',
      };
    }
  }

  /**
   * Kirim blast WhatsApp insiden ke semua karyawan menggunakan notif.my.id
   */
  async sendIncidentBlast(
    employees: Employee[],
    incidentData: IncidentData
  ): Promise<BlastResult[]> {
    const message = this.formatIncidentMessage(incidentData);
    const mediaUrl = incidentData.mediaPath ? 
      `${process.env.REPLIT_DOMAIN || 'https://localhost:5000'}${incidentData.mediaPath}` : 
      undefined;

    console.log(`Starting WhatsApp blast to ${employees.length} employees using notif.my.id...`);

    // Kirim pesan ke semua karyawan secara paralel
    const results = await Promise.all(
      employees.map(employee => 
        this.sendWhatsAppToEmployee(employee, message, mediaUrl)
      )
    );

    const successCount = results.filter(r => r.status === 'terkirim').length;
    const failedCount = results.filter(r => r.status === 'gagal').length;

    console.log(`WhatsApp blast completed using notif.my.id: ${successCount} success, ${failedCount} failed`);

    return results;
  }

  /**
   * Test koneksi ke notif.my.id API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!NOTIF_API_KEY) {
      return {
        success: false,
        message: 'NOTIF_API_KEY tidak ditemukan di environment variables'
      };
    }

    try {
      // Test dengan format API v2 yang benar
      const testPayload = {
        apikey: NOTIF_API_KEY,
        receiver: "6281234567890@c.us", // format WhatsApp ID yang benar
        mtype: "text",
        text: "Test connection from incident blast system"
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      // Response mungkin HTML atau text, bukan JSON untuk testConnection
      const responseText = await response.text();
      let result: any;
      
      try {
        result = JSON.parse(responseText);
      } catch {
        // Jika bukan JSON, gunakan text response
        result = { message: responseText, status: 'error' };
      }
      
      if (response.ok && (result.status === 'success' || result.success === true)) {
        return {
          success: true,
          message: 'Koneksi ke notif.my.id berhasil'
        };
      } else if (responseText.includes('Restrcited Area')) {
        return {
          success: false,
          message: 'API Key valid tetapi akses dibatasi. Periksa dashboard app7.notif.my.id untuk verifikasi akun dan koneksi WhatsApp device.'
        };
      } else {
        // Jika response berisi "is not registered on Whatsapp", berarti API bekerja dengan baik
        if (responseText.includes('is not registered on Whatsapp')) {
          return {
            success: true,
            message: 'Koneksi ke notif.my.id berhasil. API bekerja dengan baik.'
          };
        }
        
        // Log response untuk debugging
        console.log('Test connection response:', responseText);
        return {
          success: false,
          message: result.message || result.error || responseText || 'Gagal terhubung ke notif.my.id'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const notifMyIdService = new NotifMyIdService();