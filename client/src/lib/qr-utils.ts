import QRCode from 'qrcode';

export async function generateQRCodeCanvas(
  data: string,
  canvas: HTMLCanvasElement,
  options?: QRCode.QRCodeToCanvasOptions
): Promise<void> {
  const defaultOptions: QRCode.QRCodeToCanvasOptions = {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    ...options
  };

  await QRCode.toCanvas(canvas, data, defaultOptions);
}

export async function generateQRCodeDataURL(
  data: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToDataURLOptions = {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    ...options
  };

  return await QRCode.toDataURL(data, defaultOptions);
}

export function downloadQRCode(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL();
  link.click();
}

export function printQRCode(canvas: HTMLCanvasElement, employeeData: { id: string; name: string }): void {
  const dataUrl = canvas.toDataURL();
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code</title>
          <style>
            body { text-align: center; padding: 20px; font-family: Arial, sans-serif; }
            img { max-width: 300px; border: 1px solid #ccc; }
            .info { margin: 20px 0; }
          </style>
        </head>
        <body>
          <h2>QR Code Absensi</h2>
          <div class="info">
            <p><strong>ID:</strong> ${employeeData.id}</p>
            <p><strong>Nama:</strong> ${employeeData.name}</p>
          </div>
          <img src="${dataUrl}" alt="QR Code">
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}
