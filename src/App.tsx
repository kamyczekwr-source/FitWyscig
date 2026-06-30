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
import RaceTrack from "./components/Track"; // Zaktualizowana nazwa
import WeighInModal from "./components/WeighInModal";
import RaceChat from "./components/Chat"; // Zaktualizowana nazwa
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
import EditRaceModal from "./components/EditModal"; // Zaktualizowana nazwa

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
                console.warn("Notification trigger failed inside iframe sandbox:", e);
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
          avatar: finalAvatar,
          revealStartWeight: revealStartWeight,
        }, { merge: true });
      }

      setProfile({
        ...profile,
        name: editNickname.trim(),
        avatar: finalAvatar,
        reminderSettings: settingsPayload,
      });

      setAppSuccess("Profil został zaktualizowany!");
      setIsEditProfileOpen(false);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setAppError("Błąd aktualizacji profilu: " + (err.message || err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Calculate days remaining to race end
  const getDaysRemaining = () => {
    if (!userRace) return 0;
    const end = new Date(userRace.targetDate).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Generate weekly checkpoints based on race start and target date
  const getWeeklyCheckpoints = (startDateStrStr: string, targetDateStr: string) => {
    const checkpoints: { weekNumber: number; dateStr: string; label: string }[] = [];
    if (!startDateStrStr || !targetDateStr) return checkpoints;

    try {
      const start = new Date(startDateStrStr);
      const end = new Date(targetDateStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        return checkpoints;
      }

      // Always add Week 0 / Start
      checkpoints.push({
        weekNumber: 0,
        dateStr: startDateStrStr,
        label: "Start",
      });

      let current = new Date(start);
      let week = 1;

      while (true) {
        const nextWeek = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        const daysToTarget = (end.getTime() - nextWeek.getTime()) / (1000 * 60 * 60 * 24);
        if (daysToTarget < 3) {
          break;
        }

        const yyyy = nextWeek.getFullYear();
        const mm = String(nextWeek.getMonth() + 1).padStart(2, "0");
        const dd = String(nextWeek.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        checkpoints.push({
          weekNumber: week,
          dateStr,
          label: `Tydzień ${week}`,
        });

        current = nextWeek;
        week++;
      }

      // Always add Meta/Target date
      checkpoints.push({
        weekNumber: week,
        dateStr: targetDateStr,
        label: "Meta",
      });
    } catch (err) {
      console.error("Error generating weekly checkpoints:", err);
    }

    return checkpoints;
  };

  // Find the user's weight log closest to a checkpoint date
  const getWeightForCheckpoint = (checkpointDateStr: string, userLogs: typeof weighIns) => {
    if (userLogs.length === 0) return null;
    const targetTime = new Date(checkpointDateStr).getTime();

    let closestLog: typeof weighIns[0] | null = null;
    let minDiff = Infinity;

    for (const log of userLogs) {
      const logTime = new Date(log.date).getTime();
      const diff = Math.abs(logTime - targetTime);
      // Within 4 days
      if (diff <= 4 * 24 * 60 * 60 * 1000 && diff < minDiff) {
        minDiff = diff;
        closestLog = log;
      }
    }

    return closestLog ? closestLog.weight : null;
  };

  // Find current user's participant metrics
  const myParticipant = raceParticipants.find((p) => p.userId === user?.uid);
  const myLoss = myParticipant ? myParticipant.startWeight - myParticipant.currentWeight : 0;
  const daysRemaining = getDaysRemaining();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Scale className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse text-sm">Wczytywanie wyścigu...</p>
      </div>
    );
  }

  // If not logged in, show the AuthScreen
  if (!user || isProfileMissing) {
    return (
      <AuthScreen
        onAuthSuccess={(p) => setProfile(p)}
        isProfileMissing={isProfileMissing}
        temporaryUser={user}
        onProfileCreated={handleProfileCreated}
      />
    );
  }

  // Formatting target date for top blue header
  const getPolishFormattedTargetDate = () => {
    if (!userRace) return "";
    try {
      const dateObj = new Date(userRace.targetDate);
      return dateObj.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
      });
    } catch {
      return "25 Sierpnia";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900 pb-24 relative">
      
      {/* 1. TOP BLUE NAVBAR (High Contrast Blue) */}
      <header className="bg-blue-600 shadow-md sticky top-0 z-40 text-white h-16">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
          
          {/* Logo / App Status Name */}
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-white animate-pulse" />
            <span className="font-heading font-black text-sm sm:text-base tracking-tight truncate max-w-[240px] sm:max-w-sm">
              {userRace 
                ? `FitWyścig: Wyzwanie do ${getPolishFormattedTargetDate()}!` 
                : "FitWyścig: Wybierz Wyzwanie"}
            </span>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 border border-blue-500 rounded-full py-1 px-2.5 cursor-pointer transition-all text-left text-xs"
              title="Mój Profil"
            >
              <AvatarDisplay avatar={profile?.avatar} name={profile?.name} className="w-5 h-5 text-sm" />
              <span className="font-black text-white uppercase tracking-wider truncate max-w-[60px] sm:max-w-[100px]">
                {profile?.name}
              </span>
            </button>
            
            <button
              onClick={logoutUser}
              className="p-1.5 text-blue-100 hover:text-white hover:bg-blue-700 rounded-full transition-all cursor-pointer"
              title="Wyloguj się"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. SUB-TABS NAVIGATION (Below Header, sticky) */}
      {userRace && (
        <nav className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs overflow-x-auto no-scrollbar">
          <div className="max-w-4xl mx-auto flex items-center h-12 px-4 justify-start gap-4 sm:gap-6 whitespace-nowrap min-w-max">
            <button
              onClick={() => setActiveTab("main")}
              className={`h-full text-xs font-black tracking-widest px-1.5 relative flex items-center transition-all cursor-pointer ${
                activeTab === "main" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TOR & CZAT
              {activeTab === "main" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`h-full text-xs font-black tracking-widest px-1.5 relative flex items-center transition-all cursor-pointer ${
                activeTab === "status" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              STATUS & CELE
              {activeTab === "status" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("add_weight")}
              className={`h-full text-xs font-black tracking-widest px-1.5 relative flex items-center transition-all cursor-pointer ${
                activeTab === "add_weight" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              DODAJ WAŻENIE
              {activeTab === "add_weight" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`h-full text-xs font-black tracking-widest px-1.5 relative flex items-center transition-all cursor-pointer ${
                activeTab === "leaderboard" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              TABELA LIDERÓW
              {activeTab === "leaderboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`h-full text-xs font-black tracking-widest px-1.5 relative flex items-center transition-all cursor-pointer ${
                activeTab === "stats" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              STATYSTYKI
              {activeTab === "stats" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* 3. MAIN CONTENT BODY */}
      <main className="max-w-xl mx-auto px-4 py-6">
        
        {/* Alerts / Error & Success Notices */}
        {appError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-3 shadow-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs">Problem</p>
              <p className="text-[11px] text-rose-600 mt-0.5">{appError}</p>
            </div>
            <button onClick={() => setAppError("")} className="ml-auto text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
        {appSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3 shadow-xs">
            <Check className="w-4 h-4 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <p className="font-bold text-xs">Sukces!</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">{appSuccess}</p>
            </div>
            <button onClick={() => setAppSuccess("")} className="ml-auto text-emerald-400 hover:text-emerald-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reminder Alert Card */}
        {profile?.reminderSettings?.enabled && !dismissedReminderAlert && (() => {
          const now = new Date();
          const todayDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
          
          if (profile.reminderSettings.days.includes(todayDay)) {
            const [shour, sminute] = profile.reminderSettings.time.split(":").map(Number);
            const scheduledToday = new Date();
            scheduledToday.setHours(shour, sminute, 0, 0);
            
            if (now >= scheduledToday) {
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
              const hasLoggedToday = weighIns.some((w) => w.userId === user?.uid && w.date === todayStr);
              
              if (!hasLoggedToday) {
                return (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-3 shadow-md animate-pulse">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0 text-amber-600 mt-0.5">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-black text-xs uppercase tracking-wider text-amber-900">⏰ Czas na Ważenie!</p>
                      <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                        Hej <span className="font-bold">{profile.name}</span>, według Twojego harmonogramu nadszedł czas na dzisiejszy pomiar wagi! Zaloguj go teraz, aby Twój uczestnik kontynuował wyścig.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsWeighInOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          Zważ się teraz ⚖️
                        </button>
                        <button
                          onClick={() => setDismissedReminderAlert(true)}
                          className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                        >
                          Pomiń na dziś
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setDismissedReminderAlert(true)} className="ml-auto text-amber-400 hover:text-amber-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }
            }
          }
          return null;
        })()}

        {/* SCREEN A: User has no active race - Lobby / Setup Screen */}
        {!userRace ? (
          <div className="space-y-6 pt-4">
            <div className="text-center max-w-sm mx-auto mb-2">
              <span className="text-xs bg-blue-100 text-blue-700 font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Lobby Główne
              </span>
              <p className="text-slate-500 text-xs mt-2 font-medium">
                Aby zacząć rywalizację, stwórz nową grupę lub dołącz do gotowego wyścigu znajomych za pomocą unikalnego kodu.
              </p>
            </div>

            {/* A1. Join Existing Race */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-heading font-black text-slate-900">
                    Dołącz do Wyścigu Znajomych
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Wejdź na gotowy tor rywali
                  </p>
                </div>
              </div>

              <form onSubmit={handleJoinRace} className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Kod Wyścigu (6 znaków)
                    </label>
                    <input
                      type="text"
                      value={raceCodeInput}
                      onChange={(e) => setRaceCodeInput(e.target.value.toUpperCase())}
                      placeholder="np. ABCXYZ"
                      maxLength={10}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-center font-bold text-sm tracking-widest text-slate-800 transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Waga Startowa (kg)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={startWeightInput}
                        onChange={(e) => setStartWeightInput(e.target.value)}
                        placeholder="np. 84.5"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold text-sm text-slate-800 transition-all placeholder:text-slate-300"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase select-none">
                        kg
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center"
                >
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Dołącz do Toru Wyścigu"
                  )}
                </button>
              </form>
            </div>

            {/* A2. Create New Race */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-heading font-black text-slate-900">
                    Stwórz Nowy Wyścig
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Zaproś znajomych i określ cel
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateRace} className="space-y-4 pt-1">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Nazwa Wyścigu / Grupy
                  </label>
                  <input
                    type="text"
                    value={newRaceName}
                    onChange={(e) => setNewRaceName(e.target.value)}
                    placeholder="np. SPRINT PO ZDROWIE!"
                    maxLength={40}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm transition-all placeholder:text-slate-300"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Cel Wyścigu (Utrata kg)
                    </label>
                    <select
                      value={newRaceTargetLoss}
                      onChange={(e) => setNewRaceTargetLoss(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm transition-all cursor-pointer"
                    >
                      <option value="3">3 kg</option>
                      <option value="5">5 kg</option>
                      <option value="8">8 kg</option>
                      <option value="10">10 kg</option>
                      <option value="15">15 kg</option>
                      <option value="20">20 kg</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Data Startowa
                    </label>
                    <input
                      type="date"
                      value={newRaceStartDate}
                      onChange={(e) => setNewRaceStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 text-xs h-[38px] transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Data Końcowa (Meta)
                    </label>
                    <input
                      type="date"
                      value={newRaceTargetDate}
                      onChange={(e) => setNewRaceTargetDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 text-xs h-[38px] transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Twoja Waga Startowa (kg)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newRaceStartWeight}
                      onChange={(e) => setNewRaceStartWeight(e.target.value)}
                      placeholder="np. 84.5"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold text-sm text-slate-800 transition-all placeholder:text-slate-300"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold uppercase select-none">
                      kg
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Stwórz Wyścig i Wejdź"
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          
          /* SCREEN B: ACTIVE CHALLENGE - RENDER ACTIVE TAB */
          <div className="space-y-6">
            
            {/* TAB 1: GŁÓWNY (MAIN ATHLETIC TRACK & CHAT VIEW) */}
            {activeTab === "main" && (
              <div className="space-y-4 animate-fade-in">
                {/* Visual Athletic Running Track */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-100">
                      Na żywo: {userRace.name}
                    </span>
                    <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                      KOD: {userRace.id}
                    </span>
                  </div>
               {userRace && Array.isArray(raceParticipants) ? (
  <RaceTrack
    race={userRace}
    participants={[...raceParticipants].sort((a, b) => {
      const lossA = (a.startWeight || 0) - (a.currentWeight || 0);
      const lossB = (b.startWeight || 0) - (b.currentWeight || 0);
      if (lossA >= 1.0 && lossB < 1.0) return -1;
      if (lossB >= 1.0 && lossA < 1.0) return 1;
      return lossB - lossA;
    })}
    currentUserId={user?.uid || ""}
  />
) : null}
                </div>

                {/* Real-time Race Room Chat */}
                <RaceChat
                  raceId={userRace.id}
                  currentUser={user}
                  currentUserProfile={profile}
                />
              </div>
            )}

            {/* TAB 1B: STATUS (MAIN SUMMARY VIEW) */}
            {activeTab === "status" && (
              <div className="space-y-5 animate-fade-in">
                
                {/* Challenge Name & Info Header Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-100">
                        Grupa Rywalizacyjna
                      </span>
                      {userRace.creatorId === user?.uid && (
                        <button
                          onClick={() => setIsEditRaceOpen(true)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-extrabold px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[9px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                          title="Panel Administratora: Edytuj wyścig"
                        >
                          <Settings className="w-3 h-3 text-blue-600" />
                          Edytuj Wyścig
                        </button>
                      )}
                    </div>
                    <h1 className="text-xl font-heading font-black text-slate-900 pt-1">
                      {userRace.name}
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-bold">
                      <Users className="w-3.5 h-3.5 text-slate-300" />
                      Założyciel: <span className="font-extrabold text-slate-600">{userRace.creatorName}</span>
                    </p>
                  </div>

                  {/* Share Code & Leave Group actions inside Summary */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-3 pr-1 py-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">KOD GRUPY:</span>
                      <span className="font-mono font-black text-blue-600 text-xs tracking-wider select-all">{userRace.id}</span>
                      <button
                        onClick={handleCopyCode}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded-full transition-colors cursor-pointer"
                        title="Skopiuj kod grupy"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Clipboard className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <button
                      onClick={handleLeaveRace}
                      className="text-[10px] uppercase tracking-widest font-black text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl px-3 py-1.5 transition-all cursor-pointer"
                    >
                      Opuść Wyścig
                    </button>
                  </div>
                </div>

                {/* Grid layout for Countdown and Personal metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Countdown Card */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-full blur-lg pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Horyzont Wyzwania</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Czas do końca meta</p>
                      </div>
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-heading font-black text-slate-900">
                        {daysRemaining}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {daysRemaining === 1 ? "dzień" : "dni"}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                      Cel: <span className="text-blue-600 font-extrabold">-{userRace.targetLoss} kg!</span>
                    </div>
                  </div>

                  {/* Personal metrics card */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-full blur-lg pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Twoje Statystyki</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Postępy na torze</p>
                      </div>
                      <Scale className="w-4 h-4 text-blue-600 shrink-0" />
                    </div>

                    {myParticipant ? (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold border-b border-slate-50 pb-1">
                          <span>Start:</span>
                          <span className="font-mono font-black text-slate-800">{myParticipant.startWeight.toFixed(1)} kg</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold border-b border-slate-50 pb-1">
                          <span>Teraz:</span>
                          <span className="font-mono font-black text-slate-800">{myParticipant.currentWeight.toFixed(1)} kg</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold pt-1">
                          <span>Utrata:</span>
                          <span className={`font-mono font-black ${myLoss >= 0 ? "text-blue-600" : "text-rose-500"}`}>
                            {myLoss >= 0 ? `-${myLoss.toFixed(1)}` : `+${Math.abs(myLoss).toFixed(1)}`} kg
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 text-[10px] font-bold">
                        Brak danych. Loguj wagę!
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick actions/Instructions banner */}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3.5">
                  <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-blue-900 leading-none">Chcesz ruszyć swojego uczestnika?</p>
                    <p className="text-blue-700/80 mt-1 font-medium leading-normal">
                      Kliknij zakładkę <span className="font-bold">Dodaj Ważenie</span> lub niebieski przycisk plusa <span className="font-bold">+</span> w rogu ekranu, aby wprowadzić nowy pomiar wagi.
                    </p>
                  </div>
                </div>

                {/* Weekly Weigh-in Checkpoints Timeline */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <h3 className="font-heading font-black text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Harmonogram i Punkty Kontrolne
                    </h3>
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-extrabold uppercase">
                      Co Tydzień
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">
                    Poniższa podziałka pokazuje planowane punkty ważenia w tym wyzwaniu. Loguj wagę w okolicach tych dat, aby automatycznie odznaczać kolejne tygodnie!
                  </p>

                  <div className="relative border-l-2 border-slate-100 ml-3 pl-5 space-y-5 py-2">
                    {getWeeklyCheckpoints(userRace.startDate, userRace.targetDate).map((checkpoint, idx) => {
                      const myPersonalLogs = weighIns.filter((w) => w.userId === user?.uid);
                      const weight = getWeightForCheckpoint(checkpoint.dateStr, myPersonalLogs);
                      const checkpointDate = new Date(checkpoint.dateStr);
                      const formattedDate = checkpointDate.toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "short",
                      });
                      
                      const isFuture = checkpointDate.getTime() > new Date().getTime() + 24 * 60 * 60 * 1000;
                      const hasLogged = weight !== null;
                      const isMissed = !hasLogged && !isFuture;

                      return (
                        <div key={idx} className="relative flex items-start gap-3">
                          {/* Dot / Indicator */}
                          <div className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                            hasLogged 
                              ? "border-emerald-500 bg-emerald-50" 
                              : isMissed 
                                ? "border-amber-500 bg-amber-50" 
                                : "border-slate-300"
                          }`}>
                            {hasLogged && (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                            {isMissed && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800">
                                {checkpoint.label}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                                {formattedDate}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              {hasLogged ? (
                                <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                                  <span>Zalogowano: <strong>{weight.toFixed(1)} kg</strong></span>
                                </p>
                              ) : isFuture ? (
                                <p className="text-[11px] font-medium text-slate-400 italic">
                                  Oczekiwanie na pomiar
                                </p>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <p className="text-[11px] font-medium text-amber-600">
                                    Brak pomiaru
                                  </p>
                                  <button
                                    onClick={() => {
                                      setEmbedDate(checkpoint.dateStr);
                                      setActiveTab("add_weight");
                                    }}
                                    className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                                  >
                                    Uzupełnij
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: DODAJ WAŻENIE (EMBEDDED INPUT FORM) */}
            {activeTab === "add_weight" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-lg font-heading font-black text-slate-800 flex items-center gap-1.5">
                    <PlusCircle className="w-5 h-5 text-blue-600" />
                    Zaloguj Nową Wagę
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Wprowadź swój aktualny pomiar. Twoja pozycja na torze wyścigowym zostanie automatycznie i natychmiast przeliczona!
                  </p>
                </div>

                {embedError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl font-bold">
                    {embedError}
                  </div>
                )}

                {embedSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl font-bold">
                    {embedSuccess}
                  </div>
                )}

                <form onSubmit={handleEmbedWeightSubmit} className="space-y-4">
                  {/* Weight input */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Twoja dzisiejsza waga (kg)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={embedWeight}
                        onChange={(e) => setEmbedWeight(e.target.value)}
                        placeholder="np. 81.3"
                        disabled={isSubmittingWeight}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-lg font-bold text-slate-800 transition-all placeholder:text-slate-300"
                        required
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-sans text-xs text-slate-400 font-black uppercase select-none">
                        kg
                      </span>
                    </div>
                  </div>

                  {/* Date picker */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Data pomiaru
                    </label>
                    <input
                      type="date"
                      value={embedDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setEmbedDate(e.target.value)}
                      disabled={isSubmittingWeight}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm h-12 transition-all"
                      required
                    />
                  </div>

                  {/* Motivational note */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Dodaj motywujący komentarz (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      value={embedNote}
                      onChange={(e) => setEmbedNote(e.target.value)}
                      placeholder="np. Rower szosowy rano! 🚴‍♂️"
                      maxLength={100}
                      disabled={isSubmittingWeight}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 transition-all placeholder:text-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingWeight}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 px-4 rounded-xl shadow-md cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    {isSubmittingWeight ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Zapisywanie wagi...
                      </>
                    ) : (
                      "Zatwierdź i Wyślij na Tor"
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: TABELA LIDERÓW (DETAILED STANDINGS LIST) */}
            {activeTab === "leaderboard" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Sub-list Tabela Liderów */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-heading font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <Trophy className="w-4 h-4 text-blue-600" />
                      Klasyfikacja Uczestników
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {raceParticipants.length} Uczestników na torze
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {[...raceParticipants]
             .sort((a, b) => {
  const lossA = a.startWeight - a.currentWeight;
  const lossB = b.startWeight - b.currentWeight;
  
  // Jeśli jedna osoba spełnia warunek 1kg, a druga nie
  if (lossA >= 1.0 && lossB < 1.0) return -1;
  if (lossB >= 1.0 && lossA < 1.0) return 1;
  
  // Jeśli oboje spełniają lub oboje nie – sortuj po wyniku
  return lossB - lossA;
})
                      .map((participant, index) => {
                        const loss = participant.startWeight - participant.currentWeight;
                        const rank = index + 1;
                        const isMe = participant.userId === user.uid;

                        let badgeColor = "bg-slate-100 text-slate-500";
                        if (rank === 1) badgeColor = "bg-amber-100 text-amber-700 font-black ring-1 ring-amber-300/30";
                        else if (rank === 2) badgeColor = "bg-slate-200 text-slate-800 font-black";
                        else if (rank === 3) badgeColor = "bg-amber-50 text-amber-800 font-black";

                        return (
                          <div
                            key={participant.userId}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              isMe 
                                ? "bg-blue-50/40 border-blue-200" 
                                : "bg-slate-50 border-slate-100 hover:bg-slate-100/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Position */}
                              <div className={`w-5 h-5 rounded-md text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${badgeColor}`}>
                                {rank}
                              </div>

                              {/* Avatar */}
                              <AvatarDisplay avatar={participant.avatar} name={participant.name} className="w-7 h-7 text-lg shadow-xs" />

                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1.5 leading-none">
                                  {participant.name} 
                                  {isMe && <span className="text-[8px] text-white font-black bg-blue-600 px-1 py-0.2 rounded uppercase">TY</span>}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                  {isMe || participant.revealStartWeight ? (
                                    <>Start: {participant.startWeight.toFixed(1)} • Teraz: {participant.currentWeight.toFixed(1)} kg</>
                                  ) : (
                                    <span className="text-slate-400 flex items-center gap-1 select-none">
                                      Waga: <span className="font-sans">🔒</span> Ukryta przez uczestnika
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 pl-1">
                              <span className={`text-xs font-mono font-black ${loss >= 0 ? "text-blue-600" : "text-rose-500"}`}>
                                {loss >= 0 ? `-${loss.toFixed(1)}` : `+${Math.abs(loss).toFixed(1)}`} kg
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: STATYSTYKI (TREND SVG CHART & LOGS) */}
            {activeTab === "stats" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Interactive SVG Progress Line Chart */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="font-heading font-black text-slate-800 flex items-center gap-1.5 text-sm uppercase tracking-wider leading-none">
                        <Activity className="w-4 h-4 text-blue-600" />
                        Wykres Postępów
                      </h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">
                        Śledzenie spadku wagi w czasie
                      </p>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex gap-1 max-w-full overflow-x-auto py-1">
                      {raceParticipants.map((p) => (
                        <button
                          key={p.userId}
                          onClick={() => setSelectedStatsUserId(p.userId)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer shrink-0 transition-all ${
                            selectedStatsUserId === p.userId
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {p.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Chart Rendering */}
                  {(() => {
                    // Extract historical logs for the selected user, ordered chronologically (oldest to newest)
                    const userLogs = [...weighIns]
                      .filter((w) => w.userId === selectedStatsUserId)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    const participant = raceParticipants.find(p => p.userId === selectedStatsUserId);

                    if (selectedStatsUserId !== user?.uid && participant && !participant.revealStartWeight) {
                      return (
                        <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-2">
                          <span className="text-2xl">🔒</span>
                          Ten uczestnik ukrył swoje absolutne pomiary wagi.
                        </div>
                      );
                    }

                    if (userLogs.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                          Zaloguj pierwsze pomiary, by wygenerować wykres!
                        </div>
                      );
                    }

                    // Calculate scales
                    const width = 450;
                    const height = 180;
                    const padding = 30;

                    const weights = userLogs.map((l) => l.weight);
                    
                    // Add starting weight as first point if missing
                    if (participant && !userLogs.some(l => l.id.endsWith("_start"))) {
                      // Prepend starter weight
                      weights.unshift(participant.startWeight);
                    }

                    const minW = Math.min(...weights) - 1;
                    const maxW = Math.max(...weights) + 1;
                    const spread = maxW - minW || 1;

                    // Plot coordinates
                    const totalPoints = userLogs.length;
                    const points = userLogs.map((log, i) => {
                      const x = padding + (i / (totalPoints - 1 || 1)) * (width - 2 * padding);
                      const y = height - padding - ((log.weight - minW) / spread) * (height - 2 * padding);
                      return { x, y, weight: log.weight, date: log.date };
                    });

                    // Construct SVG path line
                    let dPath = "";
                    points.forEach((pt, idx) => {
                      if (idx === 0) dPath += `M ${pt.x} ${pt.y}`;
                      else dPath += ` L ${pt.x} ${pt.y}`;
                    });

                    // Path area underneath fill
                    const dFill = dPath 
                      ? `${dPath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
                      : "";

                    return (
                      <div className="relative">
                        {/* SVG Container */}
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                          <defs>
                            <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2"/>
                              <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f1f5f9" strokeWidth="1" />
                          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" />
                          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1.5" />

                          {/* Y-Axis weight level labels */}
                          <text x={padding - 8} y={padding + 4} textAnchor="end" className="text-[8px] font-mono font-bold fill-slate-400">{maxW.toFixed(1)}</text>
                          <text x={padding - 8} y={height / 2 + 4} textAnchor="end" className="text-[8px] font-mono font-bold fill-slate-400">{((maxW + minW) / 2).toFixed(1)}</text>
                          <text x={padding - 8} y={height - padding + 4} textAnchor="end" className="text-[8px] font-mono font-bold fill-slate-400">{minW.toFixed(1)}</text>

                          {/* Gradient Area Fill */}
                          {dFill && <path d={dFill} fill="url(#chart-grad)" />}

                          {/* Chart Line */}
                          {dPath && (
                            <path
                              d={dPath}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Dot markers */}
                          {points.map((pt, index) => (
                            <g key={index}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="4"
                                className="fill-white stroke-blue-600 stroke-2"
                              />
                              {/* Small Text above dot for last/significant points */}
                              {(index === 0 || index === points.length - 1 || points.length < 6) && (
                                <text
                                  x={pt.x}
                                  y={pt.y - 8}
                                  textAnchor="middle"
                                  className="text-[8px] font-mono font-extrabold fill-blue-700"
                                >
                                  {pt.weight.toFixed(1)} kg
                                </text>
                              )}
                            </g>
                          ))}
                        </svg>

                        {/* Date scale markers at bottom */}
                        <div className="flex justify-between px-7 pt-1 text-[8px] font-mono font-bold text-slate-400">
                          <span>{new Date(userLogs[0].date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</span>
                          {userLogs.length > 2 && (
                            <span>{new Date(userLogs[Math.floor(userLogs.length / 2)].date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</span>
                          )}
                          <span>{new Date(userLogs[userLogs.length - 1].date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Dziennik Pomiarów (Recent logs list) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                  <h3 className="font-heading font-black text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <History className="w-4 h-4 text-blue-600" />
                    Dziennik Pomiarów
                  </h3>

                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {weighIns.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-12 font-bold uppercase tracking-wider">
                        Brak zarejestrowanych pomiarów w tej grupie.
                      </p>
                    ) : (
                      weighIns.map((log) => {
                        const logParticipant = raceParticipants.find((p) => p.userId === log.userId);
                        const isMe = log.userId === user.uid;
                        
                        return (
                          <div
                            key={log.id}
                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <AvatarDisplay avatar={logParticipant?.avatar} name={log.userName} className="w-5 h-5 text-xs shadow-xs" />
                                <span className="font-extrabold text-slate-800 truncate max-w-[100px]">
                                  {log.userName}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">
                                  {new Date(log.date).toLocaleDateString("pl-PL", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              </div>

                              {log.note && (
                                <p className="mt-1 text-[11px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-100 break-words">
                                  "{log.note}"
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0 font-mono font-black text-blue-600 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {isMe || logParticipant?.revealStartWeight ? (
                                <>{log.weight.toFixed(1)} kg</>
                              ) : (
                                <span className="text-[9px] text-slate-400 select-none flex items-center gap-0.5">
                                  <span className="font-sans">🔒</span> Ukryta
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Weigh-In Modal Popup Trigger (Activated via FAB button) */}
            <WeighInModal
              isOpen={isWeighInOpen}
              onClose={() => setIsWeighInOpen(false)}
              onSubmit={handleLogNewWeight}
              currentWeight={myParticipant?.currentWeight}
              isSubmitting={isSubmittingWeight}
            />

            {/* Floating Action Button (FAB) matching high-fidelity screen */}
            <button
              onClick={() => setIsWeighInOpen(true)}
              className="fixed bottom-20 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer border border-blue-500"
              title="Dodaj szybki pomiar wagi"
              id="fab-weigh-in"
            >
              <Plus className="w-6 h-6 stroke-[3px]" />
            </button>

          </div>
        )}

        {/* 4. EDIT PROFILE SETTINGS DIALOG (Clean light-theme design) */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              
              <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <h3 className="font-heading font-black text-lg text-slate-850">
                    Edycja Profilu
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditProfileSubmit} className="space-y-4">
                {/* Nickname */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Nazwa Uczestnika
                  </label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Podaj swoje imię lub nick"
                    maxLength={20}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 transition-all text-sm"
                    required
                  />
                </div>

                {/* Predefined Avatars */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Wybierz Uczestnika
                    </label>
                    {editAvatar && (
                      <span className="text-[9px] bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 font-black uppercase tracking-widest flex items-center gap-1">
                        Podgląd: <AvatarDisplay avatar={editAvatar} name={editNickname} className="w-5 h-5 text-xs" />
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {AVAILABLE_AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setEditAvatar(avatar.emoji);
                          setEditCustomAvatar("");
                        }}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg border-2 transition-all ${
                          editAvatar === avatar.emoji
                            ? "border-blue-600 bg-white scale-105 shadow-xs"
                            : "border-transparent hover:bg-white/50"
                        }`}
                      >
                        <span className="text-2xl select-none">{avatar.emoji}</span>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-full text-center">
                          {avatar.label.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <Camera className="w-3 h-3 text-blue-600" />
                    Wgraj własne zdjęcie / grafikę
                  </label>
                  <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-3 bg-white transition-all cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setAppError("");
                            const dataUrl = await resizeImageToMax(file);
                            setEditAvatar(dataUrl);
                            setEditCustomAvatar("");
                          } catch (err: any) {
                            setAppError("Nie udało się załadować zdjęcia: " + err.message);
                          }
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center text-center space-y-0.5">
                      <div className="p-1.5 bg-slate-50 rounded-full text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">
                        Wybierz plik ze zdjęciem
                      </span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        PNG, JPG • Automatyczna kompresja
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inicjały */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Lub wprowadź własne inicjały / emoji
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={editCustomAvatar}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditCustomAvatar(val);
                      if (val.trim()) {
                        setEditAvatar(val.trim());
                      } else {
                        setEditAvatar(AVAILABLE_AVATARS[0].emoji);
                      }
                    }}
                    placeholder="np. 🚀, 🔥, 👑 lub JB"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-xs placeholder:text-slate-300 transition-all text-center"
                  />
                </div>

                 {/* Reveal Starting Weight Toggle */}
                {userRace && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-blue-600" />
                          Ujawnij wagę startową i obecną
                        </label>
                        <p className="text-[9px] text-slate-400 font-bold leading-normal">
                          Zezwól innym uczestnikom na widok Twojej wagi startowej i aktualnej. Domyślnie są ukryte.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={revealStartWeight}
                          onChange={(e) => setRevealStartWeight(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Weigh-in Reminder Settings */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <BellRing className="w-3.5 h-3.5 text-blue-600" />
                      Przypomnienia o ważeniu
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setReminderEnabled(checked);
                          if (checked && "Notification" in window && Notification.permission === "default") {
                            Notification.requestPermission().then((permission) => {
                              setNotificationPermission(permission);
                            }).catch((err) => {
                              console.warn("Notification request permission failed:", err);
                            });
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {reminderEnabled && (
                    <div className="space-y-3 pt-1">
                      {/* Day of week selector */}
                      <div className="space-y-1">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Wybierz dni tygodnia
                        </span>
                        <div className="flex justify-between gap-1">
                          {[
                            { label: "Pn", val: 1 },
                            { label: "Wt", val: 2 },
                            { label: "Śr", val: 3 },
                            { label: "Cz", val: 4 },
                            { label: "Pi", val: 5 },
                            { label: "So", val: 6 },
                            { label: "Nd", val: 0 },
                          ].map((day) => {
                            const isSelected = reminderDays.includes(day.val);
                            return (
                              <button
                                key={day.val}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setReminderDays(reminderDays.filter((d) => d !== day.val));
                                  } else {
                                    setReminderDays([...reminderDays, day.val]);
                                  }
                                }}
                                className={`w-8 h-8 rounded-full text-[10px] font-black transition-all border flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Time Selector */}
                      <div className="space-y-1">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Godzina przypomnienia
                        </span>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-xs transition-all"
                        />
                      </div>

                      {/* Browser system notification info */}
                      {"Notification" in window && (
                        <div className="text-[10px] border border-slate-100 rounded-lg p-2 bg-white text-slate-500 space-y-1 leading-relaxed">
                          <p className="font-bold flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-600">
                            Powiadomienia systemowe:{" "}
                            {notificationPermission === "granted" ? (
                              <span className="text-emerald-600 font-black">Włączone ✅</span>
                            ) : notificationPermission === "denied" ? (
                              <span className="text-rose-500 font-black">Zablokowane ❌</span>
                            ) : (
                              <span className="text-amber-600 font-black">Nieznane ❓</span>
                            )}
                          </p>
                          {notificationPermission === "default" && (
                            <button
                              type="button"
                              onClick={() => {
                                Notification.requestPermission().then((permission) => {
                                  setNotificationPermission(permission);
                                }).catch((err) => {
                                  console.warn("Could not request notification permissions:", err);
                                });
                              }}
                              className="w-full text-left font-black text-blue-600 hover:underline text-[9px] uppercase tracking-wider cursor-pointer"
                            >
                              Poproś o uprawnienia systemowe 🔔
                            </button>
                          )}
                          {notificationPermission === "denied" && (
                            <p className="text-[9px] text-slate-400 leading-normal">
                              Jeśli chcesz powiadomienia na pulpicie, odblokuj uprawnienia w kłódce obok paska adresu przeglądarki!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-widest"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-3 rounded-xl shadow-xs transition-all cursor-pointer text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Zapis...
                      </>
                    ) : (
                      "Zapisz"
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </main>

      {/* 5. BOTTOM NAVIGATION BAR (Synchronized with screenshot tabs) */}
      {userRace && (
        <footer className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-40 h-16 flex items-center justify-around px-2 shadow-lg pb-safe">
          <button
            onClick={() => setActiveTab("main")}
            className={`flex flex-col items-center justify-center gap-1 w-14 cursor-pointer ${
              activeTab === "main" ? "text-blue-600 font-extrabold" : "text-slate-400"
            }`}
          >
            <Home className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="text-[9px] font-black tracking-wider uppercase leading-none">TOR & CZAT</span>
          </button>

          <button
            onClick={() => setActiveTab("status")}
            className={`flex flex-col items-center justify-center gap-1 w-14 cursor-pointer ${
              activeTab === "status" ? "text-blue-600 font-extrabold" : "text-slate-400"
            }`}
          >
            <Calendar className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="text-[9px] font-black tracking-wider uppercase leading-none">STATUS</span>
          </button>

          <button
            onClick={() => setActiveTab("add_weight")}
            className={`flex flex-col items-center justify-center gap-1 w-14 cursor-pointer ${
              activeTab === "add_weight" ? "text-blue-600 font-extrabold" : "text-slate-400"
            }`}
          >
            <PlusCircle className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="text-[9px] font-black tracking-wider uppercase leading-none text-center">DODAJ</span>
          </button>

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex flex-col items-center justify-center gap-1 w-14 cursor-pointer ${
              activeTab === "leaderboard" ? "text-blue-600 font-extrabold" : "text-slate-400"
            }`}
          >
            <Trophy className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="text-[9px] font-black tracking-wider uppercase leading-none">LIDERÓW</span>
          </button>

          <button
            onClick={() => setActiveTab("stats")}
            className={`flex flex-col items-center justify-center gap-1 w-14 cursor-pointer ${
              activeTab === "stats" ? "text-blue-600 font-extrabold" : "text-slate-400"
            }`}
          >
            <Activity className="w-4.5 h-4.5 stroke-[2.5px]" />
            <span className="text-[9px] font-black tracking-wider uppercase leading-none">WYKRES</span>
          </button>
        </footer>
      )}

      {/* 6. ADMIN EDIT RACE MODAL */}
      {userRace && (
        <EditRaceModal
          isOpen={isEditRaceOpen}
          onClose={() => setIsEditRaceOpen(false)}
          onSubmit={handleEditRaceSubmit}
          race={userRace}
          isSubmitting={isSavingRace}
        />
      )}

    </div>
  );
}
