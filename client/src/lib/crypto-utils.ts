export const SECRET_KEY = 'AttendanceQR2024';

export function generateToken(employeeId: string): string {
  const timestamp = Date.now();
  const tokenData = `${employeeId}${SECRET_KEY}${timestamp}`;
  return btoa(tokenData).slice(0, 16);
}

export function validateQRData(qrDataString: string): { id: string; token: string } | null {
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
      // Check if it's a URL with data parameter
      if (qrDataString.includes('qr-redirect?data=')) {
        const url = new URL(qrDataString);
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          const decodedData = decodeURIComponent(dataParam);
          const qrData = JSON.parse(decodedData);
          if (qrData.id && qrData.token) {
            return { id: qrData.id, token: qrData.token };
          }
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
