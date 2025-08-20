// WhatsApp service for sending messages via notif.my.id API
export class WhatsAppService {
  private apiKey: string;
  private apiUrl: string = "https://app.notif.my.id/api/v2/send-message";

  constructor() {
    this.apiKey = process.env.NOTIF_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("NOTIF_API_KEY environment variable is required");
    }
  }

  // Send text message
  async sendTextMessage(receiver: string, message: string): Promise<any> {
    const payload = {
      apikey: this.apiKey,
      receiver: receiver,
      mtype: "text",
      text: message
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error sending text message:", error);
      throw error;
    }
  }

  // Send image message
  async sendImageMessage(receiver: string, imageUrl: string, caption?: string): Promise<any> {
    const payload = {
      apikey: this.apiKey,
      receiver: receiver,
      mtype: "image",
      text: caption || "Ini adalah image",
      url: imageUrl
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error sending image message:", error);
      throw error;
    }
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Send a test message to a dummy number to check API key validity
      const testPayload = {
        apikey: this.apiKey,
        receiver: "6281234567890@c.us", // dummy number
        mtype: "text",
        text: "API Connection Test"
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        return { success: true, message: "API connection successful" };
      } else {
        return { success: false, message: `API connection failed: ${response.statusText}` };
      }
    } catch (error) {
      return { success: false, message: `API connection error: ${error}` };
    }
  }

  // Format phone number for WhatsApp
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming Indonesia +62)
    if (!cleanPhone.startsWith('62') && cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone;
    }
    
    // Add @c.us suffix for individual numbers
    return cleanPhone + '@c.us';
  }

  // Validate phone number format
  isValidPhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }

  // Format phone number to WhatsApp format
  formatPhoneNumber(phone: string): string {
    if (!phone) return "";
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, "");
    
    // Add country code if not present
    if (!cleaned.startsWith("62")) {
      if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
      } else {
        cleaned = "62" + cleaned;
      }
    }
    
    return cleaned + "@c.us";
  }

  // Static version for backward compatibility
  static formatPhoneNumber(phone: string): string {
    const service = new WhatsAppService();
    return service.formatPhoneNumber(phone);
  }
}