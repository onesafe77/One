// Utility functions for shift determination and display

// Function to get current local time
export function getCurrentTime(): Date {
  return new Date();
}

// Function to get current local time string in HH:MM format
export function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Shift detection based on actual shift times:
  // Shift 1: 08:00-16:00 (detection window: 04:00-17:59)
  // Shift 2: 18:00-06:00 (detection window: 16:00-07:59)
  
  if (totalMinutes >= 240 && totalMinutes < 1080) { // 04:00 to 17:59
    return "Shift 1";
  } else { // 16:00 to 07:59 (next day)
    return "Shift 2";
  }
}

export function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 04:00:00 sampai 18:00:00 (240-1080 minutes)
    return totalMinutes >= 240 && totalMinutes < 1080;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 16:00:00 sampai 08:00:00 hari berikutnya (960 minutes to 480 minutes next day)
    return totalMinutes >= 960 || totalMinutes < 480;
  }
  
  return false;
}

export function getShiftDescription(shift: string): string {
  switch (shift) {
    case "Shift 1":
      return "Shift 1 (04:00 - 18:00)"; // Waktu window check-in sesuai validasi
    case "Shift 2":
      return "Shift 2 (16:00 - 08:00)"; // Waktu window check-in sesuai validasi
    default:
      return shift;
  }
}

export function getCurrentShift(): string {
  const currentTime = getCurrentTimeString();
  return determineShiftByTime(currentTime);
}

export function formatTimeWithShift(time: string): string {
  const shift = determineShiftByTime(time);
  return `${time} (${shift})`;
}