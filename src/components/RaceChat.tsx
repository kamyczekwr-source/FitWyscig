import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ChatMessage } from "../types";
import { Send, MessageSquare, Trash2, Loader2, Sparkles } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";

interface RaceChatProps {
  raceId: string;
  currentUser: {
    uid: string;
    displayName: string | null;
  };
  currentUserProfile: {
    name: string;
    avatar: string;
  } | null;
}

const PRESET_MESSAGES = [
  "Dajesz! 🔥",
  "Świetna robota! 🏃‍♂️",
  "Trzymam kciuki! 👍",
  "Krok po kroku! 🌟",
  "Nie poddajemy się! 💪",
  "Dzisiaj wjechał trening! 🏋️‍♀️",
];

export default function RaceChat({ raceId, currentUser, currentUserProfile }: RaceChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to messages
  useEffect(() => {
    setIsLoading(true);
    const chatsRef = collection(db, "races", raceId, "chats");
    const q = query(chatsRef, orderBy("createdAt", "asc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          userId: data.userId || "",
          userName: data.userName || "Uczestnik",
          userAvatar: data.userAvatar || "🏃‍♂️",
          message: data.message || "",
          createdAt: data.createdAt,
        });
      });
      setMessages(msgs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching chat messages:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [raceId]);

  // Scroll to bottom on new messages
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    // Scroll with instant behavior on first load, smooth on new messages
    if (!isLoading) {
      scrollToBottom(messages.length <= 5 ? "auto" : "smooth");
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const chatsRef = collection(db, "races", raceId, "chats");
      
      const userName = currentUserProfile?.name || currentUser.displayName || "Uczestnik";
      const userAvatar = currentUserProfile?.avatar || "🏃‍♂️";

      await addDoc(chatsRef, {
        userId: currentUser.uid,
        userName,
        userAvatar,
        message: trimmed,
        createdAt: serverTimestamp(),
      });

      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę wiadomość?")) return;
    try {
      const msgRef = doc(db, "races", raceId, "chats", msgId);
      await deleteDoc(msgRef);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-slate-800 text-xs uppercase tracking-wider">
              Czat Wyzwania
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Dopinguj innych i rozmawiaj!
            </p>
          </div>
        </div>
        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-extrabold uppercase shrink-0">
          Na żywo
        </span>
      </div>

      {/* Messages Box */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-3 px-1 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-slate-200"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ładowanie czatu...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-xs font-black text-slate-700">Cisza na czacie...</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-1 max-w-[200px]">
              Napisz coś motywującego jako pierwszy i rozkręć wyścig!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUser.uid;
            
            // Format time safely
            let formattedTime = "";
            if (msg.createdAt) {
              const dateObj = msg.createdAt.seconds 
                ? new Date(msg.createdAt.seconds * 1000) 
                : new Date(msg.createdAt);
              if (!isNaN(dateObj.getTime())) {
                formattedTime = dateObj.toLocaleTimeString("pl-PL", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }
            }

            return (
              <div 
                key={msg.id} 
                className={`flex items-start gap-2.5 max-w-[85%] ${
                  isMe ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <AvatarDisplay 
                  avatar={msg.userAvatar} 
                  name={msg.userName} 
                  className="w-7 h-7 text-sm shrink-0 border border-slate-100 shadow-xs" 
                />

                <div className="space-y-0.5 min-w-0">
                  {/* Name and time */}
                  <div className={`flex items-baseline gap-1.5 ${isMe ? "justify-end" : ""}`}>
                    <span className="text-[10px] font-black text-slate-700 truncate">
                      {msg.userName}
                    </span>
                    <span className="text-[8px] font-mono font-bold text-slate-400 shrink-0">
                      {formattedTime}
                    </span>
                  </div>

                  {/* Message bubble */}
                  <div className="relative group flex items-center gap-1.5">
                    <div 
                      className={`px-3 py-2 rounded-2xl text-xs font-semibold break-words whitespace-pre-wrap leading-relaxed ${
                        isMe 
                          ? "bg-blue-600 text-white rounded-tr-xs shadow-xs" 
                          : "bg-slate-100 text-slate-800 rounded-tl-xs"
                      }`}
                    >
                      {msg.message}
                    </div>

                    {/* Delete button (only for sender) */}
                    {isMe && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 rounded-md transition-all shrink-0 cursor-pointer"
                        title="Usuń wiadomość"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Fast Actions */}
      <div className="py-2 border-t border-slate-100 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {PRESET_MESSAGES.map((preset) => (
            <button
              key={preset}
              onClick={() => handleSendMessage(preset)}
              disabled={isSending}
              className="text-[10px] shrink-0 bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-extrabold px-2.5 py-1 rounded-full transition-all cursor-pointer disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Send form */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(newMessage);
        }}
        className="flex items-center gap-2 border-t border-slate-100 pt-3 shrink-0"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Napisz coś motywującego..."
          maxLength={500}
          disabled={isSending}
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-bold text-slate-800 placeholder:text-slate-400 h-10 transition-all"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 p-2.5 rounded-xl transition-all h-10 w-10 flex items-center justify-center cursor-pointer shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
