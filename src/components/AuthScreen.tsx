/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db, loginWithEmail, registerWithEmail } from "../lib/firebase";
import { AVAILABLE_AVATARS, UserProfile } from "../types";
import { Scale, Loader2, Sparkles, LogIn, Camera, Upload, Mail, Key, UserPlus } from "lucide-react";
import { resizeImageToMax } from "../lib/image";
import AvatarDisplay from "./AvatarDisplay";

interface AuthScreenProps {
  onAuthSuccess: (profile: UserProfile) => void;
  isProfileMissing: boolean;
  temporaryUser: User | null;
  onProfileCreated: (profile: UserProfile) => void;
}

export default function AuthScreen({
  onAuthSuccess,
  isProfileMissing,
  temporaryUser,
  onProfileCreated,
}: AuthScreenProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [nickname, setNickname] = useState(temporaryUser?.displayName || "");
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0].emoji);
  const [customAvatarInput, setCustomAvatarInput] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [error, setError] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const handleEmailAuthAction = async (action: "login" | "register") => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setError("Wpisz adres e-mail oraz hasło.");
      return;
    }
    if (passwordInput.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    setIsLoggingIn(true);
    setError("");
    try {
      if (action === "login") {
        await loginWithEmail(emailInput.trim(), passwordInput);
      } else {
        await registerWithEmail(emailInput.trim(), passwordInput);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Nie udało się autoryzować. Sprawdź e-mail i hasło.";
      if (err.code === "auth/email-already-in-use") {
        errorMsg = "Ten adres e-mail jest już w użyciu.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "Niepoprawny format adresu e-mail.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "Hasło jest zbyt słabe (min. 6 znaków).";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errorMsg = "Nieprawidłowy e-mail lub hasło.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMsg = "Logowanie e-mailem jest wyłączone w ustawieniach Firebase (kliknij Auth -> Sign-in method -> Email/Password w konsoli Firebase).";
      } else {
        errorMsg = `Błąd: ${err.message || err.code || err}`;
      }
      setError(errorMsg);
      setIsLoggingIn(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!temporaryUser) return;
    if (!nickname.trim()) {
      setError("Wpisz swoją nazwę użytkownika.");
      return;
    }

    setIsCreatingProfile(true);
    setError("");

    try {
      const profile: UserProfile = {
        userId: temporaryUser.uid,
        name: nickname.trim(),
        avatar: selectedAvatar,
        createdAt: new Date(),
      };

      await setDoc(doc(db, "users", temporaryUser.uid), {
        userId: profile.userId,
        name: profile.name,
        avatar: profile.avatar,
        createdAt: new Date(),
      });

      onProfileCreated(profile);
    } catch (err: any) {
      console.error(err);
      setError("Wystąpił błąd podczas tworzenia profilu: " + (err.message || err));
      setIsCreatingProfile(false);
    }
  };

  if (isProfileMissing && temporaryUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-6 relative overflow-hidden">
          
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-heading font-black text-slate-900 pt-2">
              Stwórz Profil Uczestnika
            </h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-bold">
              Wybierz pseudonim oraz awatar na tor wyścigowy
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            {/* Nickname input */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Twoja Nazwa (np. Tomek, Kasia)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Podaj swoje imię lub nick"
                maxLength={20}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 transition-all text-sm"
                required
              />
            </div>

            {/* Avatar Grid Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                  <span>Wybierz Swojego Uczestnika</span>
                  {selectedAvatar && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 font-black uppercase tracking-widest flex items-center gap-1.5">
                      Podgląd: <AvatarDisplay avatar={selectedAvatar} name={nickname} className="w-5 h-5 text-xs" />
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {AVAILABLE_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(avatar.emoji);
                        setCustomAvatarInput("");
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all ${
                        selectedAvatar === avatar.emoji
                          ? "border-blue-600 bg-white scale-105 shadow-md"
                          : "border-transparent hover:bg-white/60"
                      }`}
                    >
                      <span className="text-3xl select-none">{avatar.emoji}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate max-w-full text-center">
                        {avatar.label.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Own Photo */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  Lub wgraj własne zdjęcie / grafikę
                </label>
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 bg-white transition-all cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setError("");
                          const dataUrl = await resizeImageToMax(file);
                          setSelectedAvatar(dataUrl);
                          setCustomAvatarInput("");
                        } catch (err: any) {
                          setError("Nie udało się załadować zdjęcia: " + err.message);
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center text-center space-y-1">
                    <div className="p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      Wybierz plik ze zdjęciem
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      PNG, JPG • Automatyczna kompresja
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Avatar Text Field */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Lub wpisz własne inicjały / emoji
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={customAvatarInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomAvatarInput(val);
                    if (val.trim()) {
                      setSelectedAvatar(val.trim());
                    } else {
                      setSelectedAvatar(AVAILABLE_AVATARS[0].emoji);
                    }
                  }}
                  placeholder="np. 🚀, 🔥, 👑 lub JB"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm placeholder:text-slate-300 transition-all text-center"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isCreatingProfile}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 px-6 rounded-xl shadow-md transition-all cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center gap-2"
            >
              {isCreatingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                "Zatwierdź i Wejdź do Gry"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Show standard landing & login screen
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-8 text-center relative overflow-hidden">
        
        <div className="space-y-4">
          <div className="inline-flex p-4 bg-blue-50 border border-blue-100 rounded-2xl shadow-xs">
            <Scale className="w-10 h-10 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-heading font-black tracking-tight text-slate-900 leading-tight">
              Summer Sprint
            </h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full inline-block">
              Wyzwanie do 25 Sierpnia
            </p>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed pt-2">
              Zróbcie z przyjaciółmi wyścig: kto schudnie najwięcej! Śledźcie swoje postępy na żywo jako animowane awatary na eleganckim torze wyścigowym.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-left">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Adres E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="twoj@email.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Hasło (min. 6 znaków)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={() => handleEmailAuthAction("login")}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-3.5 px-4 rounded-xl shadow-md transition-all cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Zaloguj
            </button>
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={() => handleEmailAuthAction("register")}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black py-3.5 px-4 rounded-xl shadow-md transition-all cursor-pointer uppercase text-xs tracking-widest flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Zarejestruj
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed text-center pt-2">
            Wygodne i uniwersalne logowanie na każdym urządzeniu. Twoje dane pozostają w pełni bezpieczne.
          </p>
        </form>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100">
          <div className="text-center">
            <span className="text-2xl block" role="img" aria-label="race">🏁</span>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Tor Wyścigowy</p>
          </div>
          <div className="text-center">
            <span className="text-2xl block" role="img" aria-label="friends">👥</span>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Rywalizacja</p>
          </div>
          <div className="text-center">
            <span className="text-2xl block" role="img" aria-label="chart">📊</span>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Pełna Historia</p>
          </div>
        </div>

      </div>
    </div>
  );
