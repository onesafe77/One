import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export class WhatsAppService {
  static async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      if (!accountSid || !authToken || !twilioPhoneNumber) {
        console.error('Twilio credentials not configured');
        return false;
      }

      // Format nomor telepon Indonesia
      const formattedNumber = WhatsAppService.formatPhoneNumber(to);
      
      await client.messages.create({
        body: message,
        from: `whatsapp:${twilioPhoneNumber}`,
        to: `whatsapp:${formattedNumber}`
      });

      console.log(`WhatsApp message sent to ${formattedNumber}: ${message}`);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  static formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add +62 for Indonesian numbers if not present
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return '+' + cleaned;
  }

  static createLeaveReminderMessage(employeeName: string, daysUntilLeave: number, startDate: string, endDate: string): string {
    const dayText = daysUntilLeave === 1 ? 'besok' : `${daysUntilLeave} hari lagi`;
    
    return `🏖️ *Pengingat Cuti*

Halo ${employeeName},

Cuti Anda akan dimulai ${dayText}:
📅 *Tanggal:* ${startDate} - ${endDate}

Pastikan:
✅ Pekerjaan sudah diselesaikan
✅ Handover sudah dilakukan
✅ Tim sudah diinformasikan

Nikmati cuti Anda! 😊

_Sistem HR PT.GECL_`;
  }
}