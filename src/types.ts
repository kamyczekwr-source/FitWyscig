/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReminderSettings {
  enabled: boolean;
  time: string; // "HH:MM" e.g., "08:00"
  days: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
}

export interface UserProfile {
  userId: string;
  name: string;
  avatar: string; // Emoji representing the user's race character
  createdAt: any; // Firestore Timestamp
  reminderSettings?: ReminderSettings;
}

export interface Race {
  id: string; // Invite code, e.g. "WYS-ABC"
  name: string; // Custom name of the race
  creatorId: string;
  creatorName: string;
  targetDate: string; // Format "YYYY-MM-DD" (defaults to "2026-08-25")
  targetLoss: number; // Target weight loss goal in kg
  createdAt: any; // Firestore Timestamp
  startDate: string; // Format "YYYY-MM-DD" (defaults to "2026-06-27")
}

export interface Participant {
  userId: string;
  name: string;
  avatar: string;
  startWeight: number; // Logged upon joining, in kg
  currentWeight: number; // Most recent logged weight, in kg
  joinedAt: any; // Firestore Timestamp
  revealStartWeight?: boolean;
}

export interface WeighIn {
  id: string;
  userId: string;
  userName: string;
  weight: number; // Weight in kg
  date: string; // YYYY-MM-DD
  createdAt: any; // Firestore Timestamp
  note?: string; // Optional message (e.g. "Po treningu!", "Krok po kroku")
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string; // The avatar of the user
  message: string;
  createdAt: any; // Firestore Timestamp
}

export const AVAILABLE_AVATARS = [
  { id: "runner_cat", emoji: "🐱", label: "Kot Uczestnik" },
  { id: "speedy_dog", emoji: "🐶", label: "Pies Uczestnik" },
  { id: "swift_fox", emoji: "🦊", label: "Szybki Lis" },
  { id: "power_bear", emoji: "🐻", label: "Silny Niedźwiedź" },
  { id: "zen_panda", emoji: "🐼", label: "Zrównoważona Panda" },
  { id: "koala_climber", emoji: "🐨", label: "Koala Wspinacz" },
  { id: "mighty_lion", emoji: "🦁", label: "Potężny Lew" },
  { id: "jumpy_frog", emoji: "🐸", label: "Skoczna Żaba" },
  { id: "cosmic_unicorn", emoji: "🦄", label: "Kosmiczny Jednorożec" },
  { id: "wise_owl", emoji: "🦉", label: "Mądra Sowa" },
  { id: "turbo_dino", emoji: "🦖", label: "Turbo Dinozaur" },
  { id: "chill_sloth", emoji: "🦥", label: "Leniwiec Luzak" },
  { id: "pink_flamingo", emoji: "🦩", label: "Różowy Flaming" },
  { id: "water_otter", emoji: "🦦", label: "Wesoła Wydra" },
  { id: "fast_squirrel", emoji: "🐿️", label: "Szybka Wiewiórka" },
  { id: "cool_penguin", emoji: "🐧", label: "Wyluzowany Pingwin" },
];
