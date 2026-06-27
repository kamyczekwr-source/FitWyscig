/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Scale, Loader2, X } from "lucide-react";

interface WeighInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (weight: number, date: string, note: string) => Promise<void>;
  currentWeight?: number;
  isSubmitting: boolean;
}

export default function WeighInModal({
  isOpen,
  onClose,
  onSubmit,
  currentWeight,
  isSubmitting,
}: WeighInModalProps) {
  const [weight, setWeight] = useState<string>(currentWeight ? currentWeight.toString() : "");
  // Default to today's date in local timezone (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(todayStr);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsedWeight = parseFloat(weight.replace(",", "."));
    if (isNaN(parsedWeight) || parsedWeight <= 10 || parsedWeight > 500) {
      setError("Proszę wpisać prawidłową wagę (np. 74.5) w przedziale od 10 do 500 kg.");
      return;
    }

    if (!date) {
      setError("Proszę wybrać datę pomiaru.");
      return;
    }

    try {
      await onSubmit(parsedWeight, date, note.trim());
      setNote("");
      onClose();
    } catch (err: any) {
      setError("Błąd podczas zapisywania pomiaru: " + (err.message || err));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-heading font-black text-slate-800 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Zaloguj Pomiar Wagi
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Weight Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Aktualna Waga (kg)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="np. 82.5"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-lg font-bold text-slate-800 transition-all"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-sans text-xs text-slate-400 font-bold uppercase select-none">
                kg
              </span>
            </div>
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              Data Pomiaru
            </label>
            <input
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm h-12 transition-all"
              required
            />
          </div>

          {/* Note Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              Notatka / Komentarz (opcjonalnie)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. Po treningu biegowym! 🏃‍♂️"
              maxLength={150}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 hover:shadow-lg transition-all cursor-pointer text-xs uppercase tracking-widest"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Zapisywanie
                </>
              ) : (
                "Zapisz"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
