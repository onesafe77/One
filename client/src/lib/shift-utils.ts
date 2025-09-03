// Utility functions for shift determination and display

// Function to get current local time (Indonesia timezone)
export function getCurrentTime(): Date {
  const now = new Date();
  // Convert to Indonesia timezone (WITA UTC+8)
  const indonesiaOffset = 8 * 60; // 8 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (indonesiaOffset * 60000));
}

// Function to get current local time string in HH:MM format (Indonesia timezone)
export function getCurrentTimeString(): string {
  const now = new Date();
  // Convert to Indonesia timezone (WITA UTC+8)
  const indonesiaOffset = 8 * 60; // 8 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const indonesiaTime = new Date(utc + (indonesiaOffset * 60000));
  return `${indonesiaTime.getHours().toString().padStart(2, '0')}:${indonesiaTime.getMinutes().toString().padStart(2, '0')}`;
}

export function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Shift detection:
  // Shift 1: 05:00-15:30 (300-930 menit)
  // Shift 2: 16:00-20:00 (960-1200 menit)
  
  if (totalMinutes >= 960 && totalMinutes <= 1200) { // 16:00 to 20:00
    return "Shift 2";
  } else if (totalMinutes >= 300 && totalMinutes <= 930) { // 05:00 to 15:30
    return "Shift 1";
  } else {
    return "Shift 1"; // Default to Shift 1 for other times
  }
}

export function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: STRICT - Hanya boleh scan antara jam 05:00 sampai 15:30
    return totalMinutes >= 300 && totalMinutes <= 930;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: STRICT - Hanya boleh scan antara jam 16:00 sampai 20:00  
    return totalMinutes >= 960 && totalMinutes <= 1200;
  }
  
  // STRICT: Diluar shift yang ditentukan tidak boleh absensi
  return false;
}

export function getShiftDescription(shift: string): string {
  switch (shift) {
    case "Shift 1":
      return "Shift 1 (05:00 - 15:30)"; // Waktu window check-in sesuai validasi
    case "Shift 2":
      return "Shift 2 (16:00 - 20:00)"; // Waktu window check-in sesuai validasi
    default:
      return shift;
  }
}

// Function to get allowed time range for a shift
export function getShiftTimeRange(shift: string): { start: string; end: string } {
  switch (shift) {
    case "Shift 1":
      return { start: "05:00", end: "15:30" };
    case "Shift 2":
      return { start: "16:00", end: "20:00" };
    default:
      return { start: "00:00", end: "23:59" };
  }
}

// Function to check if current time is outside all allowed shift times
export function isOutsideAllShiftTimes(currentTime: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Check if time falls within any shift window
  const isInShift1 = totalMinutes >= 300 && totalMinutes <= 930; // 05:00-15:30
  const isInShift2 = totalMinutes >= 960 && totalMinutes <= 1200; // 16:00-20:00
  
  return !isInShift1 && !isInShift2;
}

export function getCurrentShift(): string {
  const currentTime = getCurrentTimeString();
  return determineShiftByTime(currentTime);
}

export function formatTimeWithShift(time: string): string {
  const shift = determineShiftByTime(time);
  return `${time} (${shift})`;
}