"use client";
import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp, Paperclip, Square, X, StopCircle, Mic,
  Globe, BrainCog, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── UCSD theme tokens ──────────────────────────────────────────────────────
// Navy dark  : #0F1D30   Navy       : #182B49   Navy light : #1F3A63
// Gold       : #C69214   Gold light : #E8B84B   Gold muted : #F5E6BB

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Inject minimal custom scrollbar CSS (client-only)
if (typeof document !== "undefined") {
  const id = "ucsd-prompt-styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.innerText = `
      *:focus-visible { outline-offset: 0 !important; }
      .ucsd-textarea::-webkit-scrollbar { width: 6px; }
      .ucsd-textarea::-webkit-scrollbar-track { background: transparent; }
      .ucsd-textarea::-webkit-scrollbar-thumb { background-color: rgba(198,146,20,0.4); border-radius: 3px; }
      .ucsd-textarea::-webkit-scrollbar-thumb:hover { background-color: rgba(198,146,20,0.65); }
    `;
    document.head.appendChild(s);
  }
}

// ── Textarea ──────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "ucsd-textarea flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-white/90 placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ── Tooltip ───────────────────────────────────────────────────────────────
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#C69214]/30 bg-[#0F1D30] px-3 py-1.5 text-sm text-white/90 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// ── Dialog ────────────────────────────────────────────────────────────────
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[#0F1D30]/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#C69214]/30 bg-[#182B49] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#0F1D30]/80 p-2 hover:bg-[#0F1D30] transition-all">
        <X className="h-5 w-5 text-white/70 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-white/90", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// ── Button ────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-gradient-to-r from-[#C69214] to-[#E8B84B] hover:from-[#E8B84B] hover:to-[#C69214] text-[#0F1D30]",
      outline: "border border-[#C69214]/40 bg-transparent hover:bg-[#1F3A63]",
      ghost: "bg-transparent hover:bg-[#1F3A63]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ── VoiceRecorder ─────────────────────────────────────────────────────────
interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording, onStartRecording, onStopRecording, visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      onStopRecording(time);
      setTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className={cn("flex flex-col items-center justify-center w-full transition-all duration-300 py-3", isRecording ? "opacity-100" : "opacity-0 h-0")}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-[#C69214] animate-pulse" />
        <span className="font-mono text-sm text-white/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-[#C69214]/60 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ── ImageViewDialog ───────────────────────────────────────────────────────
const ImageViewDialog: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[#182B49] rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Full preview" className="w-full max-h-[80vh] object-contain rounded-2xl" />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// ── PromptInput context ───────────────────────────────────────────────────
interface PromptInputContextType {
  isLoading: boolean; value: string; setValue: (v: string) => void;
  maxHeight: number | string; onSubmit?: () => void; disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false, value: "", setValue: () => {}, maxHeight: 240,
});
const usePromptInput = () => React.useContext(PromptInputContext);

interface PromptInputProps {
  isLoading?: boolean; value?: string; onValueChange?: (v: string) => void;
  maxHeight?: number | string; onSubmit?: () => void; children: React.ReactNode;
  className?: string; disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ className, isLoading = false, maxHeight = 240, value, onValueChange, onSubmit, children, disabled = false, onDragOver, onDragLeave, onDrop }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (v: string) => { setInternalValue(v); onValueChange?.(v); };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider value={{ isLoading, value: value ?? internalValue, setValue: onValueChange ?? handleChange, maxHeight, onSubmit, disabled }}>
          <div
            ref={ref}
            className={cn(
              "rounded-2xl border bg-[#0F1D30] p-2 shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-300",
              isLoading ? "border-[#C69214]/60" : "border-[#C69214]/25 hover:border-[#C69214]/45 focus-within:border-[#C69214]/60",
              className
            )}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

const PromptInputTextarea: React.FC<{ disableAutosize?: boolean; placeholder?: string } & React.ComponentProps<typeof Textarea>> = ({
  className, onKeyDown, disableAutosize = false, placeholder, ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  return (
    <Textarea
      ref={textareaRef} value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.(); } onKeyDown?.(e); }}
      className={cn("text-base", className)} disabled={disabled} placeholder={placeholder} {...props}
    />
  );
};

const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>{children}</div>
);

const PromptInputAction: React.FC<{
  tooltip: React.ReactNode; children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right"; className?: string;
}> = ({ tooltip, children, className, side = "top" }) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip>
      <TooltipTrigger asChild disabled={disabled}>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

// ── Gold divider ──────────────────────────────────────────────────────────
const GoldDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1 shrink-0">
    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#C69214]/60 to-transparent rounded-full" />
  </div>
);

// ── Toggle button ─────────────────────────────────────────────────────────
const ToggleBtn: React.FC<{
  active: boolean; onClick: () => void;
  activeColor: string; activeBg: string;
  icon: React.ReactNode; label: string;
}> = ({ active, onClick, activeColor, activeBg, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
      active ? `${activeBg} ${activeColor}` : "bg-transparent border-transparent text-white/40 hover:text-white/70"
    )}
  >
    <div className="w-5 h-5 flex items-center justify-center shrink-0">
      <motion.div
        animate={{ rotate: active ? 360 : 0, scale: active ? 1.1 : 1 }}
        whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
      >
        {icon}
      </motion.div>
    </div>
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
          className="text-xs overflow-hidden whitespace-nowrap shrink-0"
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  </button>
);

// ── Main PromptInputBox ───────────────────────────────────────────────────
export interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

// ── Web Speech API types (not in lib.dom.d.ts in older TS) ────────────────
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognition extends EventTarget {
    continuous:     boolean;
    interimResults: boolean;
    lang:           string;
    start():        void;
    stop():         void;
    abort():        void;
    onresult:  ((e: SpeechRecognitionEvent) => void) | null;
    onend:     (() => void) | null;
    onerror:   ((e: Event) => void) | null;
  }
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ onSend = () => {}, isLoading = false, placeholder = "Ask your UCSD TA...", className }, ref) => {
    const [input, setInput] = React.useState("");
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<Record<string, string>>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [liveTranscript, setLiveTranscript] = React.useState("");
    const [showSearch, setShowSearch] = React.useState(false);
    const [showThink, setShowThink] = React.useState(false);
    const [showNotes, setShowNotes] = React.useState(false);
    const uploadInputRef  = React.useRef<HTMLInputElement>(null);
    const promptBoxRef    = React.useRef<HTMLDivElement>(null);
    const recognitionRef  = React.useRef<SpeechRecognition | null>(null);

    // Start / stop Web Speech API when isRecording changes
    React.useEffect(() => {
      const SR = typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : undefined;

      if (isRecording) {
        if (!SR) return;                      // browser doesn't support it
        const rec = new SR();
        rec.continuous     = true;
        rec.interimResults = true;
        rec.lang           = "en-US";
        recognitionRef.current = rec;

        rec.onresult = (e) => {
          let finalText   = "";
          let interimText = "";
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              finalText += e.results[i][0].transcript;
            } else {
              interimText += e.results[i][0].transcript;
            }
          }
          // Accumulate final results into input; show interim separately
          if (finalText) setInput((prev) => (prev + " " + finalText).trimStart());
          setLiveTranscript(interimText);
        };

        rec.onend = () => {
          setLiveTranscript("");
          // If recognition ended by itself (silence timeout), stop recording UI too
          setIsRecording(false);
        };

        rec.onerror = () => {
          setIsRecording(false);
          setLiveTranscript("");
        };

        rec.start();
      } else {
        // Stopping: commit any live transcript to input
        if (liveTranscript) {
          setInput((prev) => (prev + " " + liveTranscript).trimStart());
        }
        setLiveTranscript("");
        recognitionRef.current?.stop();
        recognitionRef.current = null;
      }
    }, [isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

    const isImageFile = (f: File) => f.type.startsWith("image/");

    const processFile = (file: File) => {
      if (!isImageFile(file) || file.size > 10 * 1024 * 1024) return;
      setFiles([file]);
      const reader = new FileReader();
      reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
      reader.readAsDataURL(file);
    };

    const handleDragOver = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
    const handleDragLeave = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
    const handleDrop = React.useCallback((e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const imgs = Array.from(e.dataTransfer.files).filter(isImageFile);
      if (imgs.length) processFile(imgs[0]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePaste = React.useCallback((e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) { e.preventDefault(); processFile(file); break; }
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    const handleSubmit = () => {
      if (!input.trim() && files.length === 0) return;
      let prefix = "";
      if (showSearch) prefix = "[Search] ";
      else if (showThink) prefix = "[Deep Think] ";
      else if (showNotes) prefix = "[Study Notes] ";
      onSend(prefix + input, files);
      setInput(""); setFiles([]); setFilePreviews({});
    };

    const hasContent = input.trim() !== "" || files.length > 0;
    const activeLabel = showSearch ? "Search the web..." : showThink ? "Think step-by-step..." : showNotes ? "Add to study notes..." : placeholder;

    return (
      <>
        <PromptInput
          value={input} onValueChange={setInput}
          isLoading={isLoading} onSubmit={handleSubmit}
          className={cn("w-full transition-all duration-300", isRecording && "border-[#C69214]/80", className)}
          disabled={isLoading || isRecording}
          ref={ref ?? promptBoxRef}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
          {/* File previews */}
          {files.length > 0 && !isRecording && (
            <div className="flex flex-wrap gap-2 p-0 pb-1">
              {files.map((file, i) => (
                <div key={i} className="relative group">
                  {file.type.startsWith("image/") && filePreviews[file.name] && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer" onClick={() => setSelectedImage(filePreviews[file.name])}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setFiles([]); setFilePreviews({}); }}
                        className="absolute top-1 right-1 rounded-full bg-[#0F1D30]/80 p-0.5">
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className={cn("transition-all duration-300", isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100")}>
            <PromptInputTextarea placeholder={activeLabel} className="text-base" />
          </div>

          {/* Voice recorder — shows waveform while listening */}
          {isRecording && (
            <>
              <VoiceRecorder
                isRecording={isRecording}
                onStartRecording={() => {}}
                onStopRecording={() => { setIsRecording(false); }}
              />
              {liveTranscript && (
                <p className="px-3 pb-1 text-sm text-white/45 italic leading-snug">
                  {liveTranscript}
                </p>
              )}
            </>
          )}

          {/* Actions row */}
          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            {/* Left: tools */}
            <div className={cn("flex items-center gap-1 transition-opacity duration-300", isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible")}>
              {/* Attach */}
              <PromptInputAction tooltip="Attach image">
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 text-white/40 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[#1F3A63] hover:text-white/80"
                  disabled={isRecording}
                >
                  <Paperclip className="h-4 w-4" />
                  <input ref={uploadInputRef} type="file" className="hidden" accept="image/*"
                    onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); if (e.target) e.target.value = ""; }} />
                </button>
              </PromptInputAction>

              {/* Toggle group */}
              <div className="flex items-center">
                <ToggleBtn
                  active={showSearch} onClick={() => { setShowSearch(p => !p); setShowThink(false); setShowNotes(false); }}
                  activeColor="text-[#C69214]" activeBg="bg-[#C69214]/10 border-[#C69214]/60"
                  icon={<Globe className="w-4 h-4" />} label="Search"
                />
                <GoldDivider />
                <ToggleBtn
                  active={showThink} onClick={() => { setShowThink(p => !p); setShowSearch(false); setShowNotes(false); }}
                  activeColor="text-[#60a5fa]" activeBg="bg-[#60a5fa]/10 border-[#60a5fa]/60"
                  icon={<BrainCog className="w-4 h-4" />} label="Deep Think"
                />
                <GoldDivider />
                <ToggleBtn
                  active={showNotes} onClick={() => { setShowNotes(p => !p); setShowSearch(false); setShowThink(false); }}
                  activeColor="text-[#E8B84B]" activeBg="bg-[#E8B84B]/10 border-[#E8B84B]/60"
                  icon={<BookOpen className="w-4 h-4" />} label="Study Notes"
                />
              </div>
            </div>

            {/* Right: send/mic/stop */}
            <PromptInputAction tooltip={isLoading ? "Stop" : isRecording ? "Stop & review transcription" : hasContent ? "Send" : "Voice input (Web Speech API)"}>
              <Button
                variant={hasContent && !isRecording ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200 shrink-0",
                  isRecording ? "text-[#C69214] hover:bg-[#1F3A63]" : !hasContent ? "text-white/40 hover:text-white/70 hover:bg-[#1F3A63]" : ""
                )}
                onClick={() => {
                  if (isRecording) setIsRecording(false);
                  else if (hasContent) handleSubmit();
                  else setIsRecording(true);
                }}
                disabled={isLoading && !hasContent}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-[#0F1D30] animate-pulse" />
                ) : isRecording ? (
                  <StopCircle className="h-5 w-5 text-[#C69214]" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-[#0F1D30] font-bold" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";
