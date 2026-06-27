/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Settings, Loader2, X, Calendar, Trophy } from "lucide-react";
import { Race } from "../types";

interface EditRaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, targetLoss: number, targetDate: string, startDate: string) => Promise<void>;
  race: Race;
  isSubmitting: boolean;
}

export default function EditRaceModal({
  isOpen,
  onClose,
  onSubmit,
  race,
  isSubmitting,
}: EditRaceModalProps) {
  const [name, setName] = useState(race.name);
  const [targetLoss, setTargetLoss] = useState(race.targetLoss.toString());
  const [targetDate, setTargetDate] = useState(race.targetDate);
  const [startDate, setStartDate] = useState(race.startDate || "2026-06-27");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(race.name);
      setTargetLoss(race.targetLoss.toString());
      setTargetDate(race.targetDate);
      setStartDate(race.startDate || "2026-06-27");
      setError("");
    }
  }, [isOpen, race]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Proszę podać nazwę wyścigu.");
      return;
    }

    const loss = parseFloat(targetLoss.replace(",", "."));
    if (isNaN(loss) || loss <= 0 || loss > 100) {
      setError("Cel spadku wagi musi być liczbą od 0.1 do 100 kg.");
      return;
    }

    if (!startDate) {
      setError("Proszę wybrać datę początkową.");
      return;
    }

    if (!targetDate) {
      setError("Proszę wybrać datę końcową.");
      return;
    }

    try {
      await onSubmit(name.trim(), loss, targetDate, startDate);
      onClose();
    } catch (err: any) {
      setError("Nie udało się zaktualizować wyścigu: " + (err.message || err));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-heading font-black text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Panel Administratora: Edytuj Wyścig
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

          {/* Race Name */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Nazwa Wyścigu / Grupy
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Summer Sprint 2026"
              maxLength={100}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 transition-all text-sm"
              required
            />
          </div>

          {/* Target Weight Loss */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-blue-600" />
              Cel Wyścigu (Cel Spadku Wagi w kg)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={targetLoss}
                onChange={(e) => setTargetLoss(e.target.value)}
                placeholder="np. 5.0"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-base font-bold text-slate-800 transition-all"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-sans text-xs text-slate-400 font-bold uppercase select-none">
                kg
              </span>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Data Startowa Wyścigu
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm h-12 transition-all"
              required
            />
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Data Końcowa Wyścigu (Meta)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800 text-sm h-12 transition-all"
              required
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
                "Zapisz Zmiany"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
