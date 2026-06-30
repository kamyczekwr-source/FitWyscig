/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db, logoutUser, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserProfile, Participant, WeighIn, AVAILABLE_AVATARS, Race } from "./types";
import AuthScreen from "./components/AuthScreen";
import RaceTrack from "./components/RaceTrack";
import WeighInModal from "./components/WeighInModal";
import RaceChat from "./components/RaceChat";
import {
  Scale,
  LogOut,
  Plus,
  Users,
  Trophy,
  History,
  Calendar,
  Sparkles,
  Info,
  Clipboard,
  Check,
  Settings,
  X,
  Camera,
  Upload,
  Loader2,
  Home,
  Activity,
  PlusCircle,
  TrendingDown,
  BellRing,
} from "lucide-react";
import { resizeImageToMax } from "./lib/image";
import AvatarDisplay from "./components/AvatarDisplay";
import EditRaceModal from "./components/EditModal";

export default function App() {
  // Authentication & Profile states
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMissing, setIsProfileMissing] = useState(false);

  // Active Race States
  const [userRace, setUserRace] = useState<Race | null>(null);
  const [raceParticipants, setRaceParticipants] = useState<Participant[]>([]);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [isListeningToRace, setIsListeningToRace] = useState(false);

  // Active Tab View State (Synchronized with screenshot)
  const [activeTab, setActiveTab] = useState<"main" | "status" | "add_weight" | "leaderboard" | "stats">("main");

  // Setup / Entry Race States
  const [raceCodeInput, setRaceCodeInput] = useState("");
  const [startWeightInput, setStartWeightInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Custom Race Creation fields
  const [newRaceName, setNewRaceName] = useState("");
  const [newRaceTargetLoss, setNewRaceTargetLoss] = useState("5");
  const [newRaceStartDate, setNewRaceStartDate] = useState("2026-06-27"); // Default start date
  const [newRaceTargetDate, setNewRaceTargetDate] = useState("2026-08-26"); // Default target
  const [newRaceStartWeight, setNewRaceStartWeight] = useState("");

  // Modal / Form States
  const [isWeighInOpen, setIsWeighInOpen] = useState(false);
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  
  // Embedded Weight Logging Fields (for 'add_weight' tab)
  const [embedWeight, setEmbedWeight] = useState("");
  const [embedDate, setEmbedDate] = useState(new Date().toISOString().split("T")[0]);
  const [embedNote, setEmbedNote] = useState("");
  const [embedSuccess, setEmbedSuccess] = useState("");
  const [embedError, setEmbedError] = useState("");

  // Statistics State
  const [selectedStatsUserId, setSelectedStatsUserId] = useState<string>("");

  // Edit Race States (Admin)
  const [isEditRaceOpen, setIsEditRaceOpen] = useState(false);
  const [isSavingRace, setIsSavingRace] = useState(false);

  // Profile Editing States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editCustomAvatar, setEditCustomAvatar] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Reminder Settings States
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderDays, setReminderDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [dismissedReminderAlert, setDismissedReminderAlert] = useState(false);

  // Visibility of Start Weight state
  const [revealStartWeight, setRevealStartWeight] = useState(false);

  useEffect(() => {
    if (isEditProfileOpen && profile) {
      setEditNickname(profile.name);
      setEditAvatar(profile.avatar);
      const isCustom = !AVAILABLE_AVATARS.some(a => a.emoji === profile.avatar);
      setEditCustomAvatar(isCustom ? profile.avatar : "");

      // Initialize reminders
      if (profile.reminderSettings) {
        setReminderEnabled(profile.reminderSettings.enabled);
        setReminderTime(profile.reminderSettings.time);
        setReminderDays(profile.reminderSettings.days);
      } else {
        setReminderEnabled(false);
        setReminderTime("08:00");
        setReminderDays([1, 2, 3, 4, 5]);
      }

      // Initialize revealStartWeight
      const myPart = raceParticipants.find(p => p.userId === user?.uid);
      setRevealStartWeight(myPart?.revealStartWeight || false);

      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, [isEditProfileOpen, profile, raceParticipants, user]);
  
  // General Alerts
  const [appError, setAppError] = useState("");
  const [appSuccess, setAppSuccess] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Connection Validation on Boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("the client is offline")) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // 2. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setAppError("");
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              userId: data.userId,
              name: data.name,
              avatar: data.avatar,
              createdAt: data.createdAt,
              reminderSettings: data.reminderSettings,
            });
            setIsProfileMissing(false);
            
            // Default selected stats filter
            setSelectedStatsUserId(currentUser.uid);

            // Check if user is already associated with any active race
            await checkUserActiveRace(currentUser.uid);
          } else {
            setIsProfileMissing(true);
          }
        } catch (err: any) {
          console.error("Error reading profile:", err);
          setAppError("Błąd ładowania profilu użytkownika.");
          handleFirestoreError(err, OperationType.GET, "users/" + currentUser.uid);
        }
      } else {
        setProfile(null);
        setUserRace(null);
        setRaceParticipants([]);
        setWeighIns([]);
        setIsProfileMissing(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2.1 Background Timer for System Weigh-In Reminders
  useEffect(() => {
    if (!profile?.reminderSettings?.enabled || !user) return;

    // We keep track of the last time we showed a notification to avoid spamming multiple times in the same minute
    let lastNotifiedMinuteStr = "";

    const interval = setInterval(() => {
      const now = new Date();
      const todayDay = now.getDay(); // 0=Sunday, 1=Monday, etc.

      if (profile.reminderSettings.days.includes(todayDay)) {
        const [shour, sminute] = profile.reminderSettings.time.split(":").map(Number);
        if (now.getHours() === shour && now.getMinutes() === sminute) {
          const currentMinuteStr = `${now.toDateString()}_${shour}_${sminute}`;
          if (lastNotifiedMinuteStr === currentMinuteStr) return;

          // Check if user has already logged weight today
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const hasLogged = weighIns.some((w) => w.userId === user.uid && w.date === todayStr);

          if (!hasLogged) {
            lastNotifiedMinuteStr = currentMinuteStr;
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification("Czas na ważenie! ⚖️", {
                  body: `Hej ${profile.name}! Według Twojego planu nadszedł czas na pomiar wagi na FitWyścig. Zaloguj swój wynik! 🏃‍♂️`,
                });
              } catch (e) {
                sidebar.warn("Notification trigger failed inside iframe sandbox:", e);
              }
            }
          }
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [profile?.reminderSettings, weighIns, user]);

  // Check if user is in any race by searching through their stored configuration
  const checkUserActiveRace = async (userId: string) => {
    const savedRaceCode = localStorage.getItem(`fitwyścig_race_code_${userId}`);
    if (savedRaceCode) {
      try {
        const raceRef = doc(db, "races", savedRaceCode);
        const raceSnap = await getDoc(raceRef);
        if (raceSnap.exists()) {
          const partRef = doc(db, "races", savedRaceCode, "participants", userId);
          const partSnap = await getDoc(partRef);
          if (partSnap.exists()) {
            setupRaceListeners(savedRaceCode);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to restore saved race:", err);
      }
      localStorage.removeItem(`fitwyścig_race_code_${userId}`);
    }
  };

  // 3. Set up active listeners for the current race, its participants, and recent weigh-ins
  const setupRaceListeners = (raceId: string) => {
    setIsListeningToRace(true);
    
    // Listen to Race Metadata
    onSnapshot(doc(db, "races", raceId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserRace({
          id: data.id,
          name: data.name,
          creatorId: data.creatorId,
          creatorName: data.creatorName,
          startDate: data.startDate || "2026-06-27",
          targetDate: data.targetDate,
          targetLoss: data.targetLoss,
          createdAt: data.createdAt,
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `races/${raceId}`);
    });

    // Listen to Participants List
    onSnapshot(collection(db, "races", raceId, "participants"), (snapshot) => {
      const parts: Participant[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        parts.push({
          userId: d.userId,
          name: d.name,
          avatar: d.avatar,
          startWeight: d.startWeight,
          currentWeight: d.currentWeight,
          joinedAt: d.joinedAt,
          revealStartWeight: d.revealStartWeight,
        });
      });
      setRaceParticipants(parts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `races/${raceId}/participants`);
    });

    // Listen to Weigh-ins logs (most recent 50 logs)
    const q = query(
      collection(db, "races", raceId, "weighIns"),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(q, (snapshot) => {
      const logs: WeighIn[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        logs.push({
          id: d.id,
          userId: d.userId,
          userName: d.userName,
          weight: d.weight,
          date: d.date,
          createdAt: d.createdAt,
          note: d.note,
        });
      });
      setWeighIns(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `races/${raceId}/weighIns`);
    });

    // Store in LocalStorage for persistence
    if (user) {
      localStorage.setItem(`fitwyścig_race_code_${user.uid}`, raceId);
    }
  };

  const handleProfileCreated = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setIsProfileMissing(false);
  };

  // 4. Join an existing race code
  const handleJoinRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setAppError("");
    setAppSuccess("");

    const code = raceCodeInput.trim().toUpperCase();
    if (!code) {
      setAppError("Wpisz kod wyścigu.");
      return;
    }

    const startW = parseFloat(startWeightInput.replace(",", "."));
    if (isNaN(startW) || startW <= 10 || startW > 500) {
      setAppError("Podaj poprawną wagę startową w kg (np. 84.5).");
      return;
    }

    setIsJoining(true);

    try {
      const raceRef = doc(db, "races", code);
      const raceSnap = await getDoc(raceRef);

      if (!raceSnap.exists()) {
        setAppError(`Wyścig o kodzie "${code}" nie istnieje. Sprawdź kod i spróbuj ponownie.`);
        setIsJoining(false);
        return;
      }

      // Add to participants subcollection
      const participantRef = doc(db, "races", code, "participants", user.uid);
      await setDoc(participantRef, {
        userId: user.uid,
        name: profile.name,
        avatar: profile.avatar,
        startWeight: startW,
        currentWeight: startW,
        joinedAt: new Date(),
      });

      // Also create an initial weigh-in entry
      const weighInId = `${user.uid}_start`;
      const weighInRef = doc(db, "races", code, "weighIns", weighInId);
      await setDoc(weighInRef, {
        id: weighInId,
        userId: user.uid,
        userName: profile.name,
        weight: startW,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date(),
        note: "Dołączenie do wyścigu! 🚩",
      });

      setAppSuccess("Pomyślnie dołączono do wyścigu!");
      setupRaceListeners(code);
    } catch (err: any) {
      console.error(err);
      setAppError("Nie udało się dołączyć: " + (err.message || err));
      handleFirestoreError(err, OperationType.WRITE, "races/" + code);
    } finally {
      setIsJoining(false);
    }
  };

  // 5. Create a new Race Group
  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setAppError("");
    setAppSuccess("");

    if (!newRaceName.trim()) {
      setAppError("Podaj nazwę wyścigu.");
      return;
    }

    const lossGoal = parseFloat(newRaceTargetLoss);
    if (isNaN(lossGoal) || lossGoal <= 0 || lossGoal > 100) {
      setAppError("Cel utraty wagi musi wynosić od 1 do 100 kg.");
      return;
    }

    const startW = parseFloat(newRaceStartWeight.replace(",", "."));
    if (isNaN(startW) || startW <= 10 || startW > 500) {
      setAppError("Podaj poprawną wagę startową w kg (np. 84.5).");
      return;
    }

    setIsCreating(true);

    // Generate a random 6-character room code
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      // Save race metadata
      const raceRef = doc(db, "races", generatedCode);
      await setDoc(raceRef, {
        id: generatedCode,
        name: newRaceName.trim(),
        creatorId: user.uid,
        creatorName: profile.name,
        startDate: newRaceStartDate,
        targetDate: newRaceTargetDate,
        targetLoss: lossGoal,
        createdAt: new Date(),
      });

      // Save creator as first participant
      const participantRef = doc(db, "races", generatedCode, "participants", user.uid);
      await setDoc(participantRef, {
        userId: user.uid,
        name: profile.name,
        avatar: profile.avatar,
        startWeight: startW,
        currentWeight: startW,
        joinedAt: new Date(),
      });

      // Add start weigh-in log
      const weighInId = `${user.uid}_start`;
      const weighInRef = doc(db, "races", generatedCode, "weighIns", weighInId);
      await setDoc(weighInRef, {
        id: weighInId,
        userId: user.uid,
        userName: profile.name,
        weight: startW,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date(),
        note: "Inicjalny pomiar wagi! 🚀",
      });

      setAppSuccess("Twój wyścig został stworzony!");
      setupRaceListeners(generatedCode);
    } catch (err: any) {
      console.error(err);
      setAppError("Błąd podczas tworzenia wyścigu: " + (err.message || err));
      handleFirestoreError(err, OperationType.WRITE, "races");
    } finally {
      setIsCreating(false);
    }
  };

  // 6. Log a new weight entry
  const handleLogNewWeight = async (weight: number, date: string, note: string) => {
    if (!user || !profile || !userRace) return;
    setIsSubmittingWeight(true);

    try {
      const weighInId = `${user.uid}_${Date.now()}`;
      const weighInRef = doc(db, "races", userRace.id, "weighIns", weighInId);
      
      await setDoc(weighInRef, {
        id: weighInId,
        userId: user.uid,
        userName: profile.name,
        weight: weight,
        date: date,
        createdAt: new Date(),
        note: note || "",
      });

      // Update participant currentWeight
      const participantRef = doc(db, "races", userRace.id, "participants", user.uid);
      await setDoc(participantRef, {
        currentWeight: weight
      }, { merge: true });

      setAppSuccess("Nowa waga została pomyślnie zapisana!");
      setIsWeighInOpen(false);
    } catch (err: any) {
      console.error(err);
      setAppError("Błąd zapisu wagi: " + (err.message || err));
      handleFirestoreError(err, OperationType.WRITE, "races/" + userRace.id + "/weighIns");
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  // Log weight via the embedded tab form
  const handleEmbedWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmbedError("");
    setEmbedSuccess("");

    if (!user || !profile || !userRace) return;

    const parsedWeight = parseFloat(embedWeight.replace(",", "."));
    if (isNaN(parsedWeight) || parsedWeight <= 10 || parsedWeight > 500) {
      setEmbedError("Wpisz poprawną wagę (np. 74.5) od 10 do 500 kg.");
      return;
    }

    if (!embedDate) {
      setEmbedError("Wybierz datę pomiaru.");
      return;
    }

    setIsSubmittingWeight(true);

    try {
      const weighInId = `${user.uid}_${Date.now()}`;
      const weighInRef = doc(db, "races", userRace.id, "weighIns", weighInId);

      await setDoc(weighInRef, {
        id: weighInId,
        userId: user.uid,
        userName: profile.name,
        weight: parsedWeight,
        date: embedDate,
        createdAt: new Date(),
        note: embedNote.trim() || "",
      });

      const participantRef = doc(db, "races", userRace.id, "participants", user.uid);
      await setDoc(participantRef, {
        currentWeight: parsedWeight
      }, { merge: true });

      setEmbedSuccess(`Zalogowano wagę ${parsedWeight.toFixed(1)} kg! Twój uczestnik ruszył do przodu! 🏃‍♂️`);
      setEmbedWeight("");
      setEmbedNote("");
      
      // Auto switch back to leaderboard tab so they can immediately see themselves advance
      setTimeout(() => {
        setActiveTab("leaderboard");
        setEmbedSuccess("");
      }, 1800);

    } catch (err: any) {
      console.error(err);
      setEmbedError("Błąd zapisu: " + (err.message || err));
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  // 7. Copy Room Code to clipboard
  const handleCopyCode = () => {
    if (!userRace) return;
    navigator.clipboard.writeText(userRace.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // 8. Quit or leave the current race
  const handleLeaveRace = () => {
    if (window.confirm("Czy na pewno chcesz opuścić ten wyścig? Twoja historia pomiarów w tej grupie zostanie zatrzymana.")) {
      if (user) {
        localStorage.removeItem(`fitwyścig_race_code_${user.uid}`);
      }
      setUserRace(null);
      setRaceParticipants([]);
      setWeighIns([]);
      setAppSuccess("Opuszczono wyścig.");
    }
  };

  // 8.5. Edit Race settings (Admin only)
  const handleEditRaceSubmit = async (name: string, targetLoss: number, targetDate: string, startDate: string) => {
    if (!userRace || !user) return;
    
    // Safety check: is creator?
    if (userRace.creatorId !== user.uid) {
      setAppError("Brak uprawnień. Tylko założyciel wyścigu może go edytować.");
      return;
    }

    setIsSavingRace(true);
    try {
      const raceRef = doc(db, "races", userRace.id);
      await setDoc(raceRef, {
        name,
        targetLoss,
        startDate,
        targetDate,
      }, { merge: true });

      setAppSuccess("Pomyślnie zaktualizowano szczegóły wyścigu!");
    } catch (err: any) {
      console.error("Error editing race:", err);
      setAppError("Nie udało się edytować wyścigu: " + (err.message || err));
      throw err; // Let modal show the error
    } finally {
      setIsSavingRace(false);
    }
  };

  // 9. Update User Profile (Nickname & Avatar & Reminders)
  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!editNickname.trim()) {
      setAppError("Nazwa nie może być pusta.");
      return;
    }

    setIsSavingProfile(true);
    setAppError("");
    setAppSuccess("");

    try {
      const finalAvatar = editAvatar || AVAILABLE_AVATARS[0].emoji;
      const settingsPayload = {
        enabled: reminderEnabled,
        time: reminderTime,
        days: reminderDays,
      };
      
      await setDoc(doc(db, "users", user.uid), {
        userId: user.uid,
        name: editNickname.trim(),
        avatar: finalAvatar,
        createdAt: profile.createdAt || new Date(),
        reminderSettings: settingsPayload,
      });

      if (userRace) {
        await setDoc(doc(db, "races", userRace.id, "participants", user.uid), {
          name: editNickname.trim(),
          avatar
}
