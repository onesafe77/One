export const SECRET_KEY = 'AttendanceQR2024';

export function generateToken(employeeId: string): string {
  const timestamp = Date.now();
  const tokenData = `${employeeId}${SECRET_KEY}${timestamp}`;
  return btoa(tokenData).slice(0, 16);
}

export function validateQRData(qrDataString: string): { id: string; token: string } | null {
  if (!qrDataString || qrDataString.trim() === '') {
    return null;
  }
  
  try {
    // First, try direct JSON parsing
    const qrData = JSON.parse(qrDataString);
    if (qrData.id && qrData.token) {
      return { id: qrData.id, token: qrData.token };
    }
    return null;
  } catch {
    // If direct JSON parsing fails, try to extract from URL format
    try {
      // Helper function to parse URL parameters
      const parseQRParams = (url: URL) => {
        // Try multiple parameter names for compatibility
        const dataParam = url.searchParams.get('data') || url.searchParams.get('qr');
        if (dataParam) {
          const decodedData = decodeURIComponent(dataParam);
          const qrData = JSON.parse(decodedData);
          if (qrData.id && qrData.token) {
            return { id: qrData.id, token: qrData.token };
          }
        }
        return null;
      };
      
      // Check if it's a full URL with qr-redirect
      if (qrDataString.includes('qr-redirect?')) {
        const url = new URL(qrDataString);
        const result = parseQRParams(url);
        if (result) return result;
      }
      
      // Handle case where QR might be just the URL path without domain
      if (qrDataString.includes('/qr-redirect?')) {
        // Extract query string part
        const parts = qrDataString.split('/qr-redirect?');
        if (parts.length > 1) {
          const queryString = parts[1];
          const url = new URL(`http://localhost/?${queryString}`);
          const result = parseQRParams(url);
          if (result) return result;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

export function createQRPayload(employeeId: string, token: string): string {
  return JSON.stringify({ id: employeeId, token });
}
