import React, { useRef, useState, useEffect, forwardRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { Smile, Paperclip, Camera, Video, Mic, Send, X, File } from "lucide-react";
import WhatsAppAudioPreview from "./WhatsAppAudioPreview";
import toast from "react-hot-toast";
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const MessageInput = forwardRef((props, ref) => {
  const { replyTo, clearReplyTo, onSendMessage, isAiThinking, disabled = false } = props;
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const { sendMessage, sendGroupMessage, selectedGroup } = useChatStore();
  const [selection, setSelection] = useState({ start: null, end: null });
  const [showToolbar, setShowToolbar] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = ref || useRef();

  useEffect(() => {
  }, [replyTo]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle keyboard shortcut for emoji picker (Ctrl + E)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setShowEmojiPicker((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Timer effect for recording
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Listen for selection changes in contentEditable
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!inputRef.current || !sel.rangeCount) {
        setShowToolbar(false);
        return;
      }
      const range = sel.getRangeAt(0);
      if (inputRef.current.contains(range.commonAncestorContainer) && !sel.isCollapsed) {
        setShowToolbar(true);
      } else {
        setShowToolbar(false);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [inputRef]);

  // Formatting helpers
  const applyFormat = (command, value = null) => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    // Use execCommand for formatting
    document.execCommand(command, false, value);
    setShowToolbar(false);
  };

  // Clipboard actions
  const handleCopy = () => {
    if (!inputRef.current) return;
    const { start, end } = selection;
    if (start === null || end === null || start === end) return;
    navigator.clipboard.writeText(text.slice(start, end));
    setShowToolbar(false);
  };
  const handleCut = () => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    document.execCommand('cut');
    setShowToolbar(false);
  };
  const handlePaste = () => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    document.execCommand('paste');
    setShowToolbar(false);
  };
  const handleUndo = () => {
    if (!inputRef.current) return;
    document.execCommand('undo');
    setShowToolbar(false);
  };

  // Toolbar UI
  const Toolbar = () => showToolbar && (
    <div className="absolute bottom-14 left-0 z-50 text-black bg-white dark:bg-base-300 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg flex flex-col min-w-[160px]">
      <div className="flex flex-col items-center justify-between px-2 pt-2 pb-1 mr-20 border-b border-zinc-200 dark:border-zinc-600">
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); handleCopy(); }} title="Copy"><span role="img" aria-label="Copy">📋</span> Copy</button>
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); handleCut(); }} title="Cut"><span role="img" aria-label="Cut">✂️</span> Cut</button>
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); handlePaste(); }} title="Paste"><span role="img" aria-label="Paste">📋</span> Paste</button>
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); handleUndo(); }} title="Undo"><span role="img" aria-label="Undo">↩️</span> Undo</button>
      </div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <button className="font-bold p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); applyFormat('bold'); }} title="Bold">B</button>
        <button className="italic p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); applyFormat('italic'); }} title="Italic">I</button>
        <button className="line-through p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); applyFormat('strikeThrough'); }} title="Strikethrough">S</button>
        <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" onMouseDown={e => { e.preventDefault(); applyFormat('insertHTML', '<code>' + window.getSelection().toString() + '</code>'); }} title="Code">{'{}'}</button>
        {/* <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" disabled>...</button> */}
      </div>
    </div>
  );

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (50MB for videos, 10MB for images/docs)
    const maxSize = fileType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max size: ${fileType === "video" ? "50MB" : "10MB"}`);
      return;
    }

    setSelectedFile(file);
    if (fileType === "image" || fileType === "video") {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview({
          url: reader.result,
          type: fileType,
          name: file.name,
          size: file.size,
        });
        setAudioBlob(null);
        setAudioUrl(null);
      };
      reader.readAsDataURL(file);
    } else if (fileType === "document") {
      setFilePreview({
        url: null,
        type: "document",
        name: file.name,
        size: file.size,
      });
      setAudioBlob(null);
      setAudioUrl(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !filePreview && !audioBlob) return;
    setIsSending(true);
    try {
      let audioBase64 = null;
      if (audioBlob) audioBase64 = await blobToBase64(audioBlob);
      const messageData = { text: text.trim(), audio: audioBase64 };
      if (replyTo) {
        messageData.replyTo = replyTo._id;
        messageData.replyToText = replyTo.text || replyTo.fileName || "Media/Document";
        messageData.replyToSenderName = replyTo.senderName || "User";
      }
      if (filePreview) {
        if (filePreview.type === "image") messageData.image = filePreview.url;
        else if (filePreview.type === "video") messageData.video = filePreview.url;
        else if (filePreview.type === "document") {
          messageData.document = await blobToBase64(selectedFile);
          messageData.fileName = filePreview.name;
        }
      }
      if (onSendMessage) {
        await onSendMessage(messageData);
      } else if (selectedGroup) {
        await sendGroupMessage(messageData);
      } else {
        await sendMessage(messageData);
      }
      setText("");
      if (inputRef.current) inputRef.current.innerHTML = "";
      setSelectedFile(null);
      setFilePreview(null);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      if (clearReplyTo) clearReplyTo();
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleEmojiSelect = (emoji) => {
    // Insert emoji at the caret position inside the contentEditable element
    if (inputRef.current) {
      inputRef.current.focus();
      document.execCommand('insertText', false, emoji.native);
      // After insertion, synchronise the React state with the current innerHTML
      setText(inputRef.current.innerHTML);
    }
    // Close the picker (no need to append to state again as we've synced above)
    setShowEmojiPicker(false);
  };

  const handleMicClick = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Audio recording not supported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new window.MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        let chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
          chunks = [];
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          setIsRecording(false);
        };
        recorder.start();
        setIsRecording(true);
        setSelectedFile(null);
        setFilePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
        if (videoInputRef.current) videoInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
      } catch (err) {
        toast.error(`Could not start audio recording: ${err.name} - ${err.message}`);
        setIsRecording(false);
      }
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Custom placeholder logic
  const visibleText = text.replace(/<[^>]+>/g, '').trim();
  const showPlaceholder = (visibleText.length <= 1) && !isInputFocused;

  return (
    <div className="p-2 sm:p-4 w-full flex flex-col items-end relative ">
      {/* Recording indicator */}
      {isRecording && (
        <div className="w-full flex justify-center mb-2 text-red-600 font-semibold z-50">
          <span className="animate-pulse">●</span> Recording... {recordingTime}s
        </div>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <div className="w-full mb-2 flex items-center">
          <div className="h-10 w-1 rounded-l bg-green-500 mr-2" />
          <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 flex flex-col justify-center relative">
            <span className="text-xs font-bold text-green-700 dark:text-green-300 mb-0.5">
              {replyTo.senderName || "User"}
            </span>
            <span className="text-xs text-green-900 dark:text-green-100 truncate">
              {replyTo.text || replyTo.fileName || "Media/Document"}
            </span>
            <button
              onClick={clearReplyTo}
              className="absolute top-1 right-1 text-green-600 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 p-1 rounded-full focus:outline-none"
              aria-label="Cancel reply"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* File Preview Section */}
      <>
        <div className="w-full mb-2">
          {filePreview ? (
            <div className="flex items-start">
              <div className="flex items-center gap-3 bg-base-200 border border-zinc-300 rounded-lg px-3 py-2 shadow-sm">
                <div className="relative flex-shrink-0">
                  {filePreview.type === "image" ? (
                    <img
                      src={filePreview.url}
                      alt="Image Preview"
                      className="w-10 h-10 object-cover rounded-md border border-zinc-300"
                    />
                  ) : filePreview.type === "video" ? (
                    <div className="w-10 h-10 bg-zinc-700 rounded-md flex items-center justify-center">
                      <Video className="w-5 h-5 text-zinc-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-zinc-700 rounded-md flex items-center justify-center">
                      <File className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  <button
                    onClick={removeFile}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center transition-all transform hover:scale-110"
                    type="button"
                    aria-label="Remove File"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-base-content truncate max-w-[120px]">
                    {filePreview.name}
                  </span>
                  <span className="text-xs text-zinc-400">{formatFileSize(filePreview.size)}</span>
                </div>
              </div>
            </div>
          ) : audioUrl ? (
            <WhatsAppAudioPreview
              audioUrl={audioUrl}
              onDelete={() => {
                setAudioBlob(null);
                setAudioUrl(null);
              }}
            />
          ) : null}
        </div>
      </>


      {/* Audio Preview */}
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-16 left-0 z-50 shadow-xl rounded-lg overflow-hidden max-w-[90vw] sm:max-w-[320px] bg-base-100 border border-zinc-600"
          role="dialog"
          aria-label="Emoji Picker"
        >
          <EmojiPicker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="light"
            emojiSize={24}
            perLine={8}
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={4}
          />
        </div>
      )}

      {/* Input Bar */}
      {isAiThinking && (
        <div className="flex items-center justify-center py-2">
          <span className="text-sm italic text-gray-500 dark:text-gray-400 select-none">AI is thinking...</span>
        </div>
      )}
      <div className="relative w-full">
        <Toolbar />
      <form
        onSubmit={handleSendMessage}
          className={`flex-1 flex items-center relative w-full ${isAiThinking ? "opacity-50 cursor-not-allowed" : ""}`}
        autoComplete="off"
      >
        <div className="flex items-center bg-base-200 rounded-full px-2 sm:px-3 py-1.5 sm:py-2 w-full gap-2 sm:gap-3 shadow-sm ">
          <button
            type="button"
            className="text-zinc-400 hover:text-primary focus:outline-none flex-shrink-0 transform hover:scale-105 transition-transform"
            onClick={() => setShowEmojiPicker((v) => !v)}
            aria-label="Toggle Emoji Picker"
            title="Open Emoji Picker (Ctrl + E)"
          >
            <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
            <div className="relative flex-1">
              {showPlaceholder && (
                <span className="absolute left-3 top-2 sm:top-1.5 text-base-content/50 pointer-events-none select-none text-sm sm:text-base">Type a message</span>
              )}
              <div
                contentEditable
                className="flex-1 bg-transparent border-none outline-none text-sm sm:text-base text-base-content placeholder-zinc-400 custom-scrollbar"
                onInput={e => {
                  setText(e.currentTarget.innerHTML);
                  // Scroll caret into view
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (rect && e.currentTarget) {
                      e.currentTarget.scrollTop = e.currentTarget.scrollHeight;
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim() || filePreview || audioBlob) {
                      handleSendMessage(e);
                    }
                  }
                }}
                aria-label="Message Input"
                disabled={isRecording || isSending || isAiThinking}
                ref={inputRef}
                suppressContentEditableWarning
                style={{
                  whiteSpace: 'pre-wrap',
                  minHeight: '2.5rem', // ~40px
                  maxHeight: '8rem',   // ~128px, adjust as needed
                  overflowY: 'auto',
                  resize: 'none',
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imageInputRef}
            onChange={(e) => handleFileChange(e, "image")}
            aria-hidden="true"
              disabled={disabled || isRecording || isSending || isAiThinking}
          />
          <input
            type="file"
            accept="video/*"
            className="hidden"
            ref={videoInputRef}
            onChange={(e) => handleFileChange(e, "video")}
            aria-hidden="true"
              disabled={disabled || isRecording || isSending || isAiThinking}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
            className="hidden"
            ref={docInputRef}
            onChange={(e) => handleFileChange(e, "document")}
            aria-hidden="true"
              disabled={disabled || isRecording || isSending || isAiThinking}
          />
          <button
            type="button"
            className="text-zinc-400 hover:text-primary focus:outline-none flex-shrink-0 transform hover:scale-105 transition-transform"
            onClick={() => imageInputRef.current?.click()}
            aria-label="Attach Image"
              disabled={disabled || isRecording || isSending || isAiThinking}
            title="Attach image"
          >
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            className="text-zinc-400 hover:text-primary focus:outline-none flex-shrink-0 transform hover:scale-105 transition-transform"
            onClick={() => videoInputRef.current?.click()}
            aria-label="Attach Video"
              disabled={disabled || isRecording || isSending || isAiThinking}
            title="Attach video"
          >
            <Video className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            className="text-zinc-400 hover:text-primary focus:outline-none flex-shrink-0 transform hover:scale-105 transition-transform"
            onClick={() => docInputRef.current?.click()}
            aria-label="Attach Document"
              disabled={disabled || isRecording || isSending || isAiThinking}
            title="Attach document"
          >
            <Paperclip className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <button
          type={text.trim() || filePreview || audioBlob ? "submit" : "button"}
          className={`ml-1 sm:ml-2 flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-primary ${isRecording ? "animate-pulse" : ""} ${isSending ? "opacity-50 cursor-not-allowed" : ""} shadow-md hover:shadow-lg transition-all transform hover:scale-105`}
          onClick={
            !text.trim() && !filePreview && !audioBlob
              ? handleMicClick
              : undefined
          }
            disabled={disabled || isSending || isAiThinking}
          aria-label={
            text.trim() || filePreview || audioBlob
              ? "Send Message"
              : isRecording
              ? "Stop Recording"
              : "Start Recording"
          }
        >
          {text.trim() || filePreview || audioBlob ? (
            <Send className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${isSending ? "animate-pulse" : ""}`} />
          ) : (
            <Mic className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${isRecording ? "text-red-500" : ""}`} />
          )}
        </button>
      </form>
      </div>
    </div>
  );
});

export default MessageInput;

/* Hide scrollbar but keep scroll functionality */
<style jsx>{`
.custom-scrollbar::-webkit-scrollbar {
  width: 0px;
  background: transparent;
}
.custom-scrollbar {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
}
`}</style>