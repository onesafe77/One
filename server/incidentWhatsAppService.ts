import twilio from 'twilio';
import type { Employee } from '@shared/schema';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.error('Missing Twilio environment variables');
}

const client = twilio(accountSid!, authToken!);

interface IncidentData {
  incidentType: string;
  location: string;
  description: string;
  currentStatus: string;
  instructions: string;
  mediaPath?: string;
}

interface BlastResult {
  employeeId: string;
  employeeName: string;
  phoneNumber: string;
  status: 'terkirim' | 'gagal';
  errorMessage?: string;
  sentAt?: string;
}

export class IncidentWhatsAppService {
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

    return `⚠️ [Incident Notification]

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
PT. GECL Emergency Response Team`;
  }

  /**
   * Format nomor telefon ke format internasional
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Hapus spasi dan karakter non-digit
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Jika dimulai dengan 0, ganti dengan 62
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    
    // Jika belum ada country code, tambahkan 62
    if (!formatted.startsWith('62')) {
      formatted = '62' + formatted;
    }
    
    return '+' + formatted;
  }

  /**
   * Kirim pesan WhatsApp ke satu karyawan
   */
  private async sendWhatsAppToEmployee(
    employee: Employee,
    message: string,
    mediaPath?: string
  ): Promise<BlastResult> {
    try {
      const phoneNumber = this.formatPhoneNumber(employee.phone);
      
      const messageParams: any = {
        body: message,
        from: `whatsapp:${twilioPhoneNumber}`,
        to: `whatsapp:${phoneNumber}`,
      };

      // Tambahkan media jika ada
      if (mediaPath) {
        // Convert media path ke URL yang dapat diakses
        const mediaUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/objects/${mediaPath.replace('/objects/', '')}`;
        messageParams.mediaUrl = [mediaUrl];
      }

      await client.messages.create(messageParams);
      
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        phoneNumber: phoneNumber,
        status: 'terkirim',
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error sending WhatsApp to ${employee.name}:`, error);
      
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        phoneNumber: this.formatPhoneNumber(employee.phone),
        status: 'gagal',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Kirim blast WhatsApp ke seluruh karyawan
   */
  async sendIncidentBlast(
    employees: Employee[],
    incidentData: IncidentData
  ): Promise<BlastResult[]> {
    console.log(`Starting WhatsApp blast to ${employees.length} employees`);
    
    const message = this.formatIncidentMessage(incidentData);
    const results: BlastResult[] = [];
    
    // Kirim pesan secara paralel dengan batching untuk menghindari rate limiting
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < employees.length; i += batchSize) {
      batches.push(employees.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(employee => 
        this.sendWhatsAppToEmployee(employee, message, incidentData.mediaPath)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Jeda antar batch untuk menghindari rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successCount = results.filter(r => r.status === 'terkirim').length;
    const failedCount = results.filter(r => r.status === 'gagal').length;
    
    console.log(`WhatsApp blast completed: ${successCount} success, ${failedCount} failed`);
    
    return results;
  }

  /**
   * Test koneksi Twilio
   */
  async testTwilioConnection(): Promise<boolean> {
    try {
      if (!accountSid) return false;
      await client.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      console.error('Twilio connection test failed:', error);
      return false;
    }
  }
}

export const incidentWhatsAppService = new IncidentWhatsAppService();