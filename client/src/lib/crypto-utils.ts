export const SECRET_KEY = 'AttendanceQR2024';

export function generateToken(employeeId: string): string {
  const timestamp = Date.now();
  const tokenData = `${employeeId}${SECRET_KEY}${timestamp}`;
  return btoa(tokenData).slice(0, 16);
}

export function validateQRData(qrDataString: string): { id: string; token: string } | null {
  try {
    const qrData = JSON.parse(qrDataString);
    if (qrData.id && qrData.token) {
      return { id: qrData.id, token: qrData.token };
    }
    return null;
  } catch {
    return null;
  }
}

export function createQRPayload(employeeId: string, token: string): string {
  return JSON.stringify({ id: employeeId, token });
}
