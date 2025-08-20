import fetch from 'node-fetch';
import type { Employee } from '@shared/schema';

const NOTIF_API_KEY = process.env.NOTIF_API_KEY;
// Berbagai endpoint yang mungkin untuk notif.my.id
const API_ENDPOINTS = [
  "https://app7.notif.my.id/api/send",
  "https://app7.notif.my.id/req.php",
  "https://app.notif.my.id/api/send",
  "https://app.notif.my.id/api/v1/send",
];

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
   * Format nomor telepon untuk notif.my.id
   * Berdasarkan dokumentasi notif.my.id, format yang benar adalah: 628XXXXXXXXX (tanpa @c.us)
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
    
    // Return tanpa @c.us untuk notif.my.id
    return cleanPhone;
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
      // Format payload untuk req.php endpoint (form-urlencoded)
      const formData = new URLSearchParams();
      // Format yang konsisten dengan test connection
      formData.append('apikey', NOTIF_API_KEY!);
      formData.append('number', formattedPhone);
      formData.append('text', message);
      formData.append('action', 'send');

      // Tambahkan URL media jika ada
      if (mediaUrl) {
        formData.append('media', mediaUrl);
      }

      console.log(`Sending WhatsApp to ${employee.name} (${formattedPhone})...`);
      
      // Gunakan format req.php yang umum untuk WhatsApp gateway Indonesia
      const response = await fetch("https://app7.notif.my.id/req.php", {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
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
      // Test dengan nomor dummy (tidak akan terkirim tapi akan test API key)
      // Test dengan format req.php (form-urlencoded)
      const testForm = new URLSearchParams();
      // Format yang lebih umum untuk WhatsApp gateway Indonesia
      testForm.append('apikey', NOTIF_API_KEY); // beberapa menggunakan 'apikey' bukan 'api_key'
      testForm.append('number', '6281234567890'); // nomor Indonesia yang lebih valid
      testForm.append('text', 'Test connection from incident blast system'); // beberapa menggunakan 'text' bukan 'message'
      testForm.append('action', 'send'); // mungkin menggunakan 'action' bukan 'f'

      const response = await fetch("https://app7.notif.my.id/req.php", {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: testForm.toString(),
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
      
      if (response.ok && !responseText.includes('Restrcited Area')) {
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
        return {
          success: false,
          message: result.message || 'Gagal terhubung ke notif.my.id'
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