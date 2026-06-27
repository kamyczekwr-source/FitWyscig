import React from "react";

interface AvatarDisplayProps {
  avatar?: string;
  name?: string;
  className?: string; // CSS classes for sizing and formatting
}

export default function AvatarDisplay({ avatar, name = "Uczestnik", className = "w-8 h-8 text-lg" }: AvatarDisplayProps) {
  const isImage = avatar && (avatar.startsWith("data:") || avatar.startsWith("http://") || avatar.startsWith("https://"));

  if (isImage) {
    return (
      <div className={`relative flex items-center justify-center rounded-full overflow-hidden shrink-0 border border-slate-700/50 bg-slate-950 ${className}`}>
        <img
          src={avatar}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover select-none"
        />
      </div>
    );
  }

  // Render text or emoji
  return (
    <span className={`flex items-center justify-center shrink-0 select-none font-bold ${className}`} role="img" aria-label={name}>
      {avatar || "🏃‍♂️"}
    </span>
  );
}
