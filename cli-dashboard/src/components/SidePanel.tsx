"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function SidePanel({
  isOpen,
  onClose,
  title = "Insights",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Panel */}
      <div
        className={`absolute top-0 left-0 h-full w-full max-w-lg bg-paper shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col border-r border-ink/10 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 bg-white">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Close panel"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-paper space-y-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
