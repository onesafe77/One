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
   * Format nomor telepon untuk notif.my.id v2 dengan validasi ketat
   */
  private formatPhoneNumber(phone: string): string {
    console.log(`Original phone: "${phone}"`);
    
    // Hapus semua karakter non-digit dan spasi
    let cleanPhone = phone.replace(/\D/g, '');
    console.log(`Clean digits: "${cleanPhone}"`);
    
    // Validasi: harus ada digits
    if (!cleanPhone || cleanPhone.length < 10) {
      console.log(`❌ INVALID: Phone too short or empty: "${cleanPhone}"`);
      throw new Error(`Invalid phone number: "${phone}" -> "${cleanPhone}"`);
    }
    
    // Jika dimulai dengan 0 (format lokal Indonesia), ganti dengan 62
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
      console.log(`Converted from local: "${cleanPhone}"`);
    }
    
    // Jika belum dimulai dengan 62, tambahkan 62 (asumsi Indonesia)
    if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
      console.log(`Added country code: "${cleanPhone}"`);
    }
    
    // Validasi final: nomor Indonesia harus 62 + 10-13 digit
    if (cleanPhone.length < 12 || cleanPhone.length > 15) {
      console.log(`❌ INVALID: Phone length ${cleanPhone.length} not in valid range: "${cleanPhone}"`);
      throw new Error(`Invalid Indonesian phone number length: "${cleanPhone}"`);
    }
    
    const formatted = cleanPhone + '@c.us';
    console.log(`Final formatted: "${formatted}"`);
    
    return formatted;
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

    let formattedPhone: string;
    try {
      formattedPhone = this.formatPhoneNumber(employee.phone);
      console.log(`✅ Phone formatted: ${employee.name} -> ${formattedPhone}`);
    } catch (formatError) {
      console.log(`❌ Phone format error: ${employee.name} -> ${formatError}`);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        phoneNumber: employee.phone,
        status: 'gagal',
        errorMessage: `Format nomor tidak valid: ${employee.phone}`,
      };
    }

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
      
      // notif.my.id responses: success biasanya status 200, gagal bisa 500 dengan detail
      console.log(`Response for ${employee.name}: Status ${response.status}, Message: ${result.message}`);
      
      if (response.ok && (result.status === 'success' || result.success === true || responseText.includes('sent'))) {
        console.log(`✅ SUCCESS: ${employee.name} (${formattedPhone})`);
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          phoneNumber: employee.phone,
          status: 'terkirim',
          sentAt: timestamp,
        };
      } else {
        // Jika nomor WhatsApp tidak terdaftar (ini error paling umum)
        if (responseText.includes('is not registered on Whatsapp') || responseText.includes('not registered')) {
          console.log(`❌ NOT REGISTERED: ${employee.name} (${formattedPhone})`);
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            phoneNumber: employee.phone,
            status: 'gagal',
            errorMessage: `Nomor WhatsApp ${formattedPhone} tidak terdaftar`,
          };
        }
        
        // Error lain (quota, unauthorized, dll)
        console.log(`❌ ERROR: ${employee.name} (${formattedPhone}) - ${result.message}`);
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          phoneNumber: employee.phone,
          status: 'gagal',
          errorMessage: result.message || responseText || 'Gagal mengirim pesan',
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

    // Test sample dulu dengan 3 karyawan untuk debug
    console.log(`=== TESTING BLAST WITH FIRST 3 EMPLOYEES ===`);
    const testEmployees = employees.slice(0, 3);
    
    const testResults: BlastResult[] = [];
    for (const employee of testEmployees) {
      console.log(`\n--- Testing ${employee.name} ---`);
      const result = await this.sendWhatsAppToEmployee(employee, message, mediaUrl);
      testResults.push(result);
      
      // Wait 1 detik antara request untuk menghindari rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`=== TEST RESULTS ===`);
    const testSuccess = testResults.filter(r => r.status === 'terkirim').length;
    const testFailed = testResults.filter(r => r.status === 'gagal').length;
    console.log(`Test: ${testSuccess} success, ${testFailed} failed out of ${testEmployees.length}`);
    
    // Jika test gagal semua, jangan lanjut blast ke semua
    if (testSuccess === 0) {
      console.log(`❌ ALL TEST FAILED - ABORTING FULL BLAST`);
      
      // Tambahkan error message untuk semua employee lain
      const remainingResults: BlastResult[] = employees.slice(3).map(emp => ({
        employeeId: emp.id,
        employeeName: emp.name,
        phoneNumber: emp.phone,
        status: 'gagal',
        errorMessage: 'Blast dibatalkan karena test sampel gagal semua',
      }));
      
      return [...testResults, ...remainingResults];
    }
    
    // Jika ada yang berhasil, lanjut blast ke semua
    console.log(`✅ Test partially successful - continuing with full blast`);
    
    // Blast ke sisanya (skip yang sudah di test)
    const remainingEmployees = employees.slice(3);
    const remainingResults = await Promise.all(
      remainingEmployees.map(employee => 
        this.sendWhatsAppToEmployee(employee, message, mediaUrl)
      )
    );
    
    const results = [...testResults, ...remainingResults];

    const successCount = results.filter(r => r.status === 'terkirim').length;
    const failedCount = results.filter(r => r.status === 'gagal').length;

    console.log(`WhatsApp blast completed using notif.my.id: ${successCount} success, ${failedCount} failed`);

    return results;
  }

  /**
   * Test koneksi ke notif.my.id API dengan debugging detail
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    console.log("=== NOTIF.MY.ID CONNECTION TEST START ===");
    
    if (!NOTIF_API_KEY) {
      console.log("❌ API KEY NOT FOUND");
      return {
        success: false,
        message: '❌ NOTIF_API_KEY tidak ditemukan. Silakan set API key terlebih dahulu.'
      };
    }

    console.log(`✅ API Key found: ${NOTIF_API_KEY.substring(0, 10)}...`);
    console.log(`🔗 Testing URL: ${API_URL}`);

    try {
      // Test dengan format API v2 yang benar
      const testPayload = {
        apikey: NOTIF_API_KEY,
        receiver: "6281234567890@c.us", // format WhatsApp ID Indonesia
        mtype: "text",
        text: "🔥 Test koneksi sistem AttendanceQR - " + new Date().toLocaleString('id-ID')
      };

      console.log('📤 Sending test payload:', {
        ...testPayload,
        apikey: `${NOTIF_API_KEY.substring(0, 8)}***`
      });

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      console.log('📥 Raw Response:', responseText);
      
      let result: any;
      try {
        result = JSON.parse(responseText);
        console.log('📄 Parsed JSON:', result);
      } catch {
        console.log('📄 Not JSON, treating as text');
        result = { message: responseText, rawText: responseText };
      }
      
      // PENTING: notif.my.id mengirim status 500 untuk "not registered" - ini NORMAL!
      // "Not registered" berarti API key valid dan berfungsi, hanya nomor test tidak terdaftar
      if (responseText.includes('is not registered on Whatsapp') || 
          responseText.includes('not registered')) {
        console.log("✅ API WORKS PERFECT! (test number not registered - this is NORMAL)");
        return {
          success: true,
          message: '✅ API berfungsi sempurna! Nomor test tidak terdaftar WhatsApp (ini normal). API siap blast karyawan!'
        };
      }
      
      // Analisa berbagai kemungkinan response
      if (response.status === 200) {
        // Success cases
        if (result.status === 'success' || result.success === true) {
          console.log("✅ PERFECT SUCCESS");
          return {
            success: true,
            message: '✅ Test message terkirim! API notif.my.id siap mengirim blast.'
          };
        }
        
        // API working but with different message
        if (responseText.includes('sent') || responseText.includes('delivered')) {
          console.log("✅ MESSAGE SENT");
          return {
            success: true,
            message: '✅ Test message berhasil dikirim! API siap digunakan.'
          };
        }
        
        console.log("⚠️ STATUS 200 but unknown response");
        return {
          success: false,
          message: `⚠️ Response tidak dikenal. Status: 200. Response: ${responseText.substring(0, 200)}`
        };
      } 
      
      // Handle error statuses
      if (response.status === 401 || responseText.includes('Unauthorized')) {
        console.log("❌ UNAUTHORIZED - API KEY ISSUE");
        return {
          success: false,
          message: '❌ API key tidak valid atau expired. Silakan periksa API key di dashboard notif.my.id'
        };
      }
      
      if (responseText.includes('Restricted Area') || responseText.includes('restricted')) {
        console.log("❌ RESTRICTED ACCESS");
        return {
          success: false,
          message: '❌ Akses dibatasi. Periksa status akun dan device di dashboard notif.my.id'
        };
      }
      
      if (responseText.includes('quota') || responseText.includes('limit')) {
        console.log("❌ QUOTA/LIMIT EXCEEDED");
        return {
          success: false,
          message: '❌ Quota API habis atau limit tercapai. Periksa dashboard notif.my.id'
        };
      }
      
      console.log(`❌ UNKNOWN ERROR - Status: ${response.status}`);
      return {
        success: false,
        message: `❌ Error tidak dikenal. Status: ${response.status}. Response: ${responseText.substring(0, 150)}`
      };
      
    } catch (error) {
      console.log("❌ EXCEPTION:", error);
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      let friendlyMsg = errorMsg;
      
      if (errorMsg.includes('fetch')) {
        friendlyMsg = 'Tidak dapat menghubungi server notif.my.id - periksa internet';
      } else if (errorMsg.includes('timeout')) {
        friendlyMsg = 'Timeout - server notif.my.id lambat merespons';
      }
      
      return {
        success: false,
        message: `❌ Connection error: ${friendlyMsg}`
      };
    }
  }
}

export const notifMyIdService = new NotifMyIdService();