/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Participant, Race } from "../types";
import AvatarDisplay from "./AvatarDisplay";

interface RaceTrackProps {
  race: Race;
  participants: Participant[];
  currentUserId: string | null;
}

export default function RaceTrack({ race, participants, currentUserId }: RaceTrackProps) {
  // Sort participants by total kilograms lost in descending order to calculate ranking
  const sortedParticipants = [...participants].sort((a, b) => {
    const lossA = a.startWeight - a.currentWeight;
    const lossB = b.startWeight - b.currentWeight;
    return lossB - lossA; // Most lost is first
  });

  const getRank = (userId: string) => {
    const index = sortedParticipants.findIndex((p) => p.userId === userId);
    return index !== -1 ? index + 1 : 0;
  };

  const celWeight = race.targetLoss > 0 ? race.targetLoss : 5;
  const maxWeight = celWeight * 2;

  // Helper to format meta date beautifully (e.g. "2026-08-25" -> "25.08")
  const formatMetaDate = (dateStr: string) => {
    if (!dateStr) return "25.08";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parts[2];
      const month = parts[1];
      return `${day}.${month}`;
    }
    return "25.08";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
      {/* Track Canvas Container with Horizontal Scrolling if narrow */}
      <div className="overflow-x-auto pt-10 pb-8 px-1">
        <div className="min-w-[580px] md:min-w-full relative">
          
          {/* Main Track Frame */}
          <div className="relative border border-slate-200 rounded-xl bg-slate-50 overflow-hidden flex flex-col">
            
            {/* START Vertical Left Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-blue-600 flex items-center justify-center z-10 shadow-sm border-r border-blue-700">
              <span className="text-white font-heading font-black text-xs uppercase tracking-widest select-none [writing-mode:vertical-lr] [transform:rotate(180deg)] py-2 text-center">
                START
              </span>
            </div>

            {/* META Vertical Right Bar */}
            <div className="absolute right-0 top-0 bottom-0 w-14 bg-slate-800 flex items-center justify-center z-10 shadow-sm border-l border-slate-900">
              <span className="text-white font-heading font-black text-[10px] uppercase tracking-wider select-none [writing-mode:vertical-lr] [transform:rotate(180deg)] py-2 text-center leading-none">
                META {formatMetaDate(race.targetDate)}
              </span>
            </div>

            {/* Sky is the Limit Cosmic Background Zone (Right 50%) */}
            <div className="absolute left-[calc(10px+50%)] right-14 top-0 bottom-0 bg-gradient-to-r from-emerald-500/5 via-purple-500/15 to-pink-500/25 pointer-events-none z-5 overflow-hidden border-l border-dashed border-purple-300">
              {/* Fun, Cheerful & High-Visibility floating elements */}
              <div className="absolute top-1 left-[15%] text-xs opacity-90 animate-pulse">⭐</div>
              <div className="absolute top-6 left-[35%] text-base opacity-90 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] animate-bounce" style={{ animationDuration: "3s" }}>🪐</div>
              <div className="absolute bottom-1 left-[55%] text-xs opacity-90 animate-pulse">✨</div>
              <div className="absolute top-2.5 right-[25%] text-lg opacity-90 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] animate-bounce" style={{ animationDuration: "2.5s" }}>🚀</div>
              <div className="absolute bottom-2 right-[40%] text-sm opacity-90 animate-pulse" style={{ animationDuration: "1.8s" }}>🎈</div>
              <div className="absolute bottom-5 right-[10%] text-xs opacity-80">🌟</div>
              
              {/* Vibrant & Cheerful styled backdrop text */}
              <div className="absolute inset-0 flex items-center justify-center select-none opacity-30">
                <span className="text-purple-700 font-heading font-black text-[10px] sm:text-xs tracking-[0.25em] uppercase whitespace-nowrap bg-purple-100/60 px-3 py-1.5 rounded-full border border-purple-200/50 shadow-xs">
                  🌌 SKY IS THE LIMIT 🪐
                </span>
              </div>
            </div>

            {/* Grid Lines Area (inside the lanes but absolute) */}
            <div className="absolute left-10 right-14 top-0 bottom-0 pointer-events-none z-5">
              {/* 0% line */}
              <div className="absolute left-[0%] top-0 bottom-0 w-px bg-slate-300/60"></div>
              {/* 25% line */}
              <div className="absolute left-[25%] top-0 bottom-0 w-px border-l border-dashed border-slate-300"></div>
              
              {/* 50% line (CEL / GOAL) */}
              <div className="absolute left-[50%] top-0 bottom-0 w-0.5 bg-emerald-500 z-10 flex flex-col items-center">
                <div className="absolute top-2 bg-emerald-500 text-white text-[8px] font-black tracking-wider px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap uppercase">
                  CEL: -{celWeight}KG 🏁
                </div>
              </div>

              {/* 75% line */}
              <div className="absolute left-[75%] top-0 bottom-0 w-px border-l border-dashed border-slate-300/60"></div>
              {/* 100% line */}
              <div className="absolute left-[100%] top-0 bottom-0 w-px bg-slate-300/60"></div>
            </div>

            {/* Lanes Container (padding-left & padding-right matches START and META bars) */}
            <div className="flex flex-col relative z-20 pl-10 pr-14 py-4 divide-y divide-slate-100 min-h-[220px]">
              {participants.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                  Tor czeka na pierwszych uczestników!
                </div>
              ) : (
                participants.map((participant, index) => {
                  const loss = participant.startWeight - participant.currentWeight;
                  
                  // Progress mapping:
                  // 0% to 50% of the track represents 0 to celWeight
                  // 50% to 100% of the track represents celWeight to maxWeight
                  let progressPercentage = 0;
                  if (loss > 0) {
                    if (loss <= celWeight) {
                      progressPercentage = (loss / celWeight) * 50;
                    } else {
                      progressPercentage = 50 + ((loss - celWeight) / (maxWeight - celWeight)) * 50;
                    }
                  }
                  
                  // Clamp percentage between 0 and 100 for visual position
                  const clampedProgress = Math.max(0, Math.min(100, progressPercentage));
                  const rank = getRank(participant.userId);
                  const isCurrentUser = participant.userId === currentUserId;

                  // Tooltip styling based on position
                  const isFirst = rank === 1 && loss >= 1;
                  const hasCrown = loss >= celWeight;
                  const inSkyZone = loss > celWeight;
                  
                  return (
                    <div key={participant.userId} className="relative h-20 flex items-center group">
                      {/* Lane background highlight for current user */}
                      {isCurrentUser && (
                        <div className="absolute inset-0 bg-blue-50/40 pointer-events-none"></div>
                      )}
                      
                      {/* Lane number */}
                      <span className="absolute left-2.5 text-[9px] font-mono font-bold text-slate-400 select-none z-10">
                        #{index + 1}
                      </span>

                      {/* Animated Runner Container */}
                      <motion.div
                        initial={{ left: "0%" }}
                        animate={{ left: `${clampedProgress}%` }}
                        transition={{ type: "spring", stiffness: 45, damping: 12 }}
                        className="absolute -translate-x-1/2 flex flex-col items-center z-30"
                        style={{ width: "80px" }} // Constrain width for perfect text wrapping and alignment
                      >
                        {/* Speech Bubble / Progress Label */}
                        <div className={`relative mb-2.5 px-2 py-1 rounded-lg border shadow-xs text-center flex flex-col items-center justify-center transition-all ${
                          isFirst 
                            ? "bg-amber-100 text-amber-900 border-amber-300" 
                            : inSkyZone
                              ? "bg-purple-100 text-purple-950 border-purple-300"
                              : "bg-white text-slate-700 border-slate-200"
                        }`}>
                          {/* Crown for those who reached the goal */}
                          {hasCrown && !inSkyZone && (
                            <span className="absolute -top-3 text-[11px] filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)] select-none animate-pulse" title="Cel osiągnięty! 👑">
                              👑
                            </span>
                          )}

                          {/* Rocket badge for those who reached Sky Is The Limit */}
                          {inSkyZone && (
                            <span className="absolute -top-3.5 text-[11px] select-none filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)] animate-bounce" title="W kosmosie! Sky is the limit! 🚀">
                              🚀
                            </span>
                          )}

                          {isFirst && (
                            <span className="text-[7px] font-black tracking-widest text-amber-700 uppercase leading-none block mb-0.5">
                              LIDER 🏆
                            </span>
                          )}
                          
                          {/* Name */}
                          <span className="text-[9px] font-extrabold truncate max-w-[70px] leading-tight block">
                            {rank}. {participant.name}
                          </span>
                          
                          {/* Loss */}
                          <span className={`text-[9px] font-mono font-bold leading-none mt-0.5 ${
                            loss >= celWeight
                              ? "text-emerald-600 font-black"
                              : loss >= 0 
                                ? (isFirst ? "text-amber-700" : "text-blue-600") 
                                : "text-rose-500"
                          }`}>
                            {loss >= 0 ? `-${loss.toFixed(1)}` : `+${Math.abs(loss).toFixed(1)}`} kg
                          </span>

                          {/* Bubble caret/arrow pointing down */}
                          <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${
                            isFirst 
                              ? "border-t-amber-300" 
                              : inSkyZone
                                ? "border-t-purple-300"
                                : "border-t-slate-200"
                          }`}></div>
                          <div className={`absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-l-transparent border-r-transparent ${
                            isFirst 
                              ? "border-t-amber-100" 
                              : inSkyZone
                                ? "border-t-purple-100"
                                : "border-t-white"
                          }`}></div>
                        </div>

                        {/* Runner Avatar Circle */}
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white transition-all shadow-md ${
                          isFirst 
                            ? "border-amber-400 ring-2 ring-amber-400/20" 
                            : inSkyZone
                              ? "border-purple-500 ring-2 ring-purple-400/40 animate-pulse"
                              : isCurrentUser 
                                ? "border-blue-500 ring-2 ring-blue-500/20" 
                                : "border-slate-300"
                        }`}>
                          <AvatarDisplay avatar={participant.avatar} name={participant.name} className="w-full h-full text-xl" />
                        </div>
                      </motion.div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Grid line labels at the bottom (aligned with percentage lines / representing weight loss) */}
          <div className="absolute left-10 right-14 bottom-1 pointer-events-none z-10 flex justify-between px-0">
            <span className="text-[9px] font-black text-slate-500 -translate-x-1/2">0 kg</span>
            <span className="text-[9px] font-bold text-slate-400 -translate-x-1/2">{(celWeight / 2).toFixed(1)} kg</span>
            <span className="text-[9px] font-black text-emerald-600 -translate-x-1/2 bg-emerald-50 px-1 rounded border border-emerald-100">CEL: {celWeight} kg</span>
            <span className="text-[9px] font-bold text-purple-400 -translate-x-1/2">{(celWeight + celWeight / 2).toFixed(1)} kg</span>
            <span className="text-[9px] font-black text-purple-700 -translate-x-1/2 bg-purple-50 px-1 rounded border border-purple-100">MAX: {maxWeight} kg</span>
          </div>

        </div>
      </div>
    </div>
  );
}
