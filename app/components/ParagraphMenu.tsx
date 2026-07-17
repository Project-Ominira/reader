"use client";

import { useState } from "react";
import { Copy, Highlighter, MessageCircle, Share2 } from "lucide-react";

export default function ParagraphMenu() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [highlighted, setHighlighted] = useState(true);
  const [copied, setCopied] = useState(false);

  const doCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setMenuOpen(false);
    }, 900);
  };

  return (
    <div className="w-full box-border font-serif px-15 py-12 relative">
      <p className="text-[17px] leading-[1.7] text-sand-950 mb-5">
        We have a world to win. We must not allow the dead weight of the past to
        strangle the creative fire of the future.
      </p>

      <div className="relative">
        {menuOpen && (
          <div className="absolute -top-14 left-0 flex items-center bg-sand-950 rounded-md shadow-lg overflow-hidden z-10">
            <button
              onClick={() => {
                setHighlighted((h) => !h);
                setMenuOpen(false);
              }}
              className="flex items-center gap-1.5 bg-transparent border-none text-white py-2.5 px-3.5 cursor-pointer text-sm border-r border-white/15"
            >
              <Highlighter size={15} />
              Highlight
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-1.5 bg-transparent border-none text-white py-2.5 px-3.5 cursor-pointer text-sm border-r border-white/15"
            >
              <MessageCircle size={15} />
              Note
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-1.5 bg-transparent border-none text-white py-2.5 px-3.5 cursor-pointer text-sm border-r border-white/15"
            >
              <Share2 size={15} />
              Share
            </button>
            <button
              onClick={doCopy}
              className="flex items-center gap-1.5 bg-transparent border-none text-white py-2.5 px-3.5 cursor-pointer text-sm"
            >
              <Copy size={15} />
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}

        <p
          onMouseUp={() => setMenuOpen(true)}
          className={`text-[17px] leading-[1.7] text-sand-950 m-0 cursor-text select-text rounded-r-xs ${
            highlighted ? "bg-highlight border-l-[3px] border-brand-300 py-2.5 px-3.5" : "border-l-[3px] border-transparent py-2.5 px-0"
          }`}
        >
          National culture is the healing of the wounds. But it is a long labor,
          and the first condition is a total rupture.{" "}
          <span className={menuOpen ? "bg-brand-500/15" : ""}>
            This rupture is not a negative thing; it is a positive necessity.
          </span>{" "}
          It is the breaking of a neck that has been bent too long.
        </p>
      </div>

      <p className="text-[17px] leading-[1.7] text-sand-950 mt-5">
        The history of the oppressor is also the history of the oppressed. But
        for the oppressed, history has too often been a record written by
        someone else.
      </p>
      <p className="text-xs font-medium text-sand-500 mt-7">
        Click the sentence to re-open the toolbar · click Highlight to toggle
        the applied wash · Copy shows a confirmation.
      </p>
    </div>
  );
}
