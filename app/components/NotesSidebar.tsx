"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Globe, Heart, Mic, Play, X } from "lucide-react";

function wave(n: number) {
  return Array.from({ length: n }, (_, i) => 3 + Math.round(Math.abs(Math.sin(i * 3.1)) * 11));
}

type Message = {
  name: string;
  initials: string;
  avatarBg: string;
  time: string;
  text?: string;
  likes: number;
  isVoice?: boolean;
  isVoiceSession?: boolean;
  wave?: number[];
  dur?: string;
  sessionTitle?: string;
  participants?: number;
};

const DEFAULT_MESSAGES: Message[] = [
  {
    name: "KofiWrites",
    initials: "K",
    avatarBg: "bg-brand-500",
    time: "9:12 AM",
    text: "This line resonates so deeply right now. The rupture is necessary before anything new can be born.",
    likes: 6,
  },
  {
    name: "Amina",
    initials: "A",
    avatarBg: "bg-olive-500",
    time: "9:28 AM",
    isVoice: true,
    wave: wave(20),
    dur: "0:22",
    text: "I hear this as both a warning and an invitation. Without the rupture, we keep repeating the same patterns.",
    likes: 5,
  },
  {
    name: "Kwame",
    initials: "K",
    avatarBg: "bg-oxblood-500",
    time: "Yesterday",
    isVoiceSession: true,
    sessionTitle: "Rupture and Renewal",
    wave: wave(20),
    dur: "32:47",
    participants: 7,
    likes: 0,
  },
  {
    name: "Lela",
    initials: "L",
    avatarBg: "bg-forest-500",
    time: "9:52 AM",
    text: "The healing is collective. No one heals in isolation.",
    likes: 4,
  },
];

type Props = {
  mode?: "thread" | "add";
  panelType?: "side" | "sheet";
  passageText?: string;
  onClose?: () => void;
};

export default function NotesSidebar({
  mode = "thread",
  panelType,
  passageText = "National culture is the healing of the wounds. But it is a long labor, and the first condition is a total rupture.",
  onClose,
}: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [visibility, setVisibility] = useState(true);
  const [saved, setSaved] = useState(false);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => {
    if (recTimer.current) clearInterval(recTimer.current);
  }, []);

  const isThread = mode === "thread";
  const isAdd = mode === "add";
  const isSheet = panelType ? panelType === "sheet" : isMobile;

  const startRecording = () => {
    setIsRecording(true);
    setRecSeconds(0);
    setTranscript("");
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };
  const stopRecording = () => {
    if (recTimer.current) clearInterval(recTimer.current);
    setIsRecording(false);
    setTranscript(
      "Fanon argues that the colonized must refuse the inertia of the past. Creation requires rupture."
    );
  };
  const onSendReply = () => {
    if (!replyDraft.trim()) return;
    setMessages((m) => [
      ...m,
      { name: "You", initials: "Y", avatarBg: "bg-sand-800", time: "Now", text: replyDraft, likes: 0 },
    ]);
    setReplyDraft("");
  };
  const onSaveNote = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const likeMessage = (i: number) =>
    setMessages((m) => m.map((msg, idx) => (idx === i ? { ...msg, likes: msg.likes + 1 } : msg)));

  return (
    <div
      className={`w-full h-full min-h-dvh box-border relative flex overflow-hidden ${
        isSheet ? "justify-center items-end" : "justify-end items-stretch"
      }`}
    >
      <div
        className={`max-w-full bg-[var(--reader-surface)] shadow-lg flex flex-col box-border overflow-hidden flex-none ${
          isSheet
            ? "w-full h-[82%] max-h-[82%] rounded-t-lg"
            : "w-95 h-full max-h-full border border-[var(--reader-border)]"
        }`}
      >
        {isSheet && (
          <div className="flex justify-center pt-2.5 pb-1 flex-none">
            <div className="w-9 h-1 rounded-full bg-[var(--reader-border)]" />
          </div>
        )}

        {isThread && (
          <>
            <div className="px-5 pt-4 pb-3 border-b border-[var(--reader-border)] flex-none">
              <div className="flex items-center justify-between">
                <span className="text-[17px] font-semibold text-[var(--reader-text)]">
                  Discussion on this passage
                </span>
                <span onClick={onClose} className="cursor-pointer text-[var(--reader-text-muted)]">
                  <X size={18} />
                </span>
              </div>
              <p
                style={{ background: "var(--reader-highlight)" }}
                className="font-serif text-[15px] leading-[1.65] text-[var(--reader-text)] border-l-[3px] border-brand-300 py-2.5 px-3 rounded-r-xs my-3 mb-2"
              >
                {passageText}
              </p>
              <div className="text-xs font-medium text-[var(--reader-text-muted)]">
                6 replies · 3 voice notes · 1 voice session
              </div>
            </div>

            <div className="om-scroll flex-1 overflow-y-auto px-5 py-3.5 flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex-none flex items-center justify-center text-xs font-bold text-white ${msg.avatarBg}`}
                  >
                    {msg.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--reader-text)]">
                      {msg.name}{" "}
                      <span className="text-[var(--reader-text-muted)] font-normal">· {msg.time}</span>
                    </div>
                    {msg.isVoice && (
                      <div className="flex items-center gap-2 mt-1.5 bg-[var(--reader-surface-hover)] rounded-full py-1.5 px-3">
                        <span className="w-5.5 h-5.5 rounded-full bg-brand-500 flex items-center justify-center flex-none">
                          <Play size={11} className="text-white" />
                        </span>
                        <div className="flex-1 h-3.5 flex items-center gap-px">
                          {msg.wave!.map((w, wi) => (
                            <div
                              key={wi}
                              style={{ height: w }}
                              className="w-0.5 bg-brand-300 rounded-sm"
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-[var(--reader-text-muted)] flex-none">
                          {msg.dur}
                        </span>
                      </div>
                    )}
                    {msg.text && (
                      <p className="text-sm text-[var(--reader-text)] my-1.5 mt-1.5 mb-1">{msg.text}</p>
                    )}
                    {msg.isVoiceSession && (
                      <div className="mt-1.5 bg-[var(--reader-surface-hover)] border border-[var(--reader-border)] rounded-sm py-2.5 px-3 text-[var(--reader-text)]">
                        <div className="text-sm mb-1.5">{msg.sessionTitle}</div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-none">
                            <Play size={12} className="text-white" />
                          </span>
                          <div className="flex-1 h-3.5 flex items-center gap-px">
                            {msg.wave!.map((w, wi) => (
                              <div
                                key={wi}
                                style={{ height: w }}
                                className="w-0.5 bg-[var(--reader-text-subtle)] rounded-sm"
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--reader-text-muted)] mt-1.5">
                          {msg.participants} participants · {msg.dur}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3.5 mt-1">
                      <span
                        onClick={() => likeMessage(i)}
                        className="text-xs font-medium text-[var(--reader-text-muted)] cursor-pointer flex items-center gap-1"
                      >
                        <Heart size={12} />
                        {msg.likes}
                      </span>
                      <span className="text-xs font-medium text-[var(--reader-text-muted)] cursor-pointer">
                        Reply
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 border-t border-[var(--reader-border)] flex-none flex items-center gap-2.5">
              <input
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Write a reply or record a voice note..."
                className="flex-1 border border-[var(--reader-border)] rounded-full py-2.5 px-4 text-sm bg-[var(--reader-surface-hover)] outline-none box-border"
              />
              <button className="bg-transparent border-none cursor-pointer text-[var(--reader-text-muted)]">
                <Mic size={18} />
              </button>
              <button
                onClick={onSendReply}
                className="w-8.5 h-8.5 rounded-full bg-brand-500 border-none cursor-pointer flex items-center justify-center flex-none"
              >
                <ChevronRight size={16} className="text-white" />
              </button>
            </div>
          </>
        )}

        {isAdd && (
          <>
            <div className="px-5 py-4 border-b border-[var(--reader-border)] flex-none flex items-center justify-between">
              <span className="text-[17px] font-semibold text-[var(--reader-text)]">
                Add note to passage
              </span>
              <span onClick={onClose} className="cursor-pointer text-[var(--reader-text-muted)]">
                <X size={18} />
              </span>
            </div>
            <div className="om-scroll flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
              <p
                style={{ background: "var(--reader-highlight)" }}
                className="font-serif text-[15px] leading-[1.65] text-[var(--reader-text)] border-l-[3px] border-brand-300 py-2.5 px-3 rounded-r-xs m-0"
              >
                {passageText}
              </p>
              <div className="relative">
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Write your note..."
                  className="w-full min-h-[70px] border border-[var(--reader-border)] rounded-md py-3 pl-3 pr-19 text-sm resize-y box-border outline-none"
                />
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    onClick={startRecording}
                    className="bg-transparent border-none cursor-pointer text-[var(--reader-text-muted)] w-6.5 h-6.5 flex items-center justify-center"
                  >
                    <Mic size={17} />
                  </button>
                  <button
                    onClick={onSaveNote}
                    className="w-6.5 h-6.5 rounded-full bg-brand-500 border-none cursor-pointer flex items-center justify-center flex-none"
                  >
                    <ChevronRight size={14} className="-rotate-90 text-white" />
                  </button>
                </div>
              </div>

              {isRecording && (
                <div>
                  <div className="text-xs font-medium text-[var(--reader-text-muted)] mb-1.5">Recording...</div>
                  <div className="flex items-center gap-2.5 bg-[var(--reader-surface-hover)] rounded-md py-2.5 px-3.5">
                    <div className="flex-1 h-5 flex items-center gap-[1.5px] overflow-hidden">
                      {wave(40).map((b, i) => (
                        <div key={i} style={{ height: b }} className="w-[2.5px] rounded-sm bg-brand-500 flex-none" />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-[var(--reader-text-muted)] flex-none">
                      00:{String(recSeconds).padStart(2, "0")}
                    </span>
                    <button
                      onClick={stopRecording}
                      className="w-7 h-7 rounded-full bg-brand-500 border-none cursor-pointer flex items-center justify-center flex-none"
                    >
                      <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                    </button>
                  </div>
                </div>
              )}
              {!isRecording && !transcript && (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 bg-transparent border border-dashed border-[var(--reader-border)] rounded-md py-2.5 px-3.5 cursor-pointer text-[var(--reader-text-muted)] text-sm w-fit"
                >
                  <Mic size={16} /> Record a voice note
                </button>
              )}
              {transcript && (
                <div>
                  <div className="text-xs font-medium text-[var(--reader-text-muted)] mb-1.5">
                    Recording finished (transcribed)
                  </div>
                  <p className="text-sm text-[var(--reader-text)] bg-[var(--reader-surface-hover)] rounded-md p-3 m-0">
                    {transcript}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-2 text-sm text-[var(--reader-text)]">
                  <Globe size={16} className="text-[var(--reader-text-muted)]" />
                  Public
                </span>
                <div
                  onClick={() => setVisibility((v) => !v)}
                  className={`w-10.5 h-6 rounded-full relative cursor-pointer flex-none ${
                    visibility ? "bg-brand-500" : "bg-[var(--reader-border)]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ease-out ${
                      visibility ? "left-5" : "left-0.5"
                    }`}
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 flex-none">
              <button
                onClick={onSaveNote}
                className="w-full h-11 rounded-md bg-brand-500 text-white font-semibold text-sm"
              >
                {saved ? "Saved ✓" : "Save note"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
