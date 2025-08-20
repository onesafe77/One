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

  // Send text message with retry mechanism
  async sendTextMessage(receiver: string, message: string, retries: number = 2): Promise<any> {
    const payload = {
      apikey: this.apiKey,
      receiver: receiver,
      mtype: "text",
      text: message
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for ${receiver}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Connection": "keep-alive"
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        
        if (result.status === false) {
          throw new Error(`WhatsApp API error: ${result.message || 'Unknown error'}`);
        }
        
        return result;
      } catch (error) {
        console.error(`Text message attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) {
          throw error;
        }
      }
    }
  }

  // Send image message with retry and fallback
  async sendImageMessage(receiver: string, caption: string, imageUrl: string, retries: number = 1): Promise<any> {
    const payload = {
      apikey: this.apiKey,
      receiver: receiver,
      mtype: "image",
      text: caption || "Ini adalah image",
      url: imageUrl
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Image retry attempt ${attempt} for ${receiver}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Connection": "keep-alive"
          },
          body: JSON.stringify(payload),
          // Add timeout to avoid hanging connections
        });

        const result = await response.json();
        
        if (result.status === false) {
          throw new Error(`WhatsApp API error: ${result.message || 'Unknown error'}`);
        }
        
        return result;
      } catch (error) {
        console.error(`Image message attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) {
          throw error;
        }
      }
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

  // Validate phone number format
  isValidPhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }

  // Static version for backward compatibility
  static formatPhoneNumber(phone: string): string {
    const service = new WhatsAppService();
    return service.formatPhoneNumber(phone);
  }
}