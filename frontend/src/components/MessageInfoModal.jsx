import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios";
import { Check, CheckCheck, Clock } from "lucide-react";

export default function MessageInfoModal({ messageId, open, onClose }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !messageId) return;
    setLoading(true);
    setError("");
    axiosInstance.get(`/messages/info/${messageId}`)
      .then(res => setInfo(res.data))
      .catch(() => setError("Failed to load message info"))
      .finally(() => setLoading(false));
  }, [open, messageId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#F0F0F0] dark:bg-[#202C33] rounded-xl p-6 w-full max-w-sm shadow-lg relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-[#075E54] text-xl">×</button>
        <h2 className="text-lg font-bold mb-4 text-[#075E54] dark:text-[#25D366]">Message Info</h2>
        {loading ? (
          <div className="text-center py-8 text-[#111B21] dark:text-[#E9EDEF]">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-[#EA4335]">{error}</div>
        ) : info ? (
          <>
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                {info.delivered ? (
                  <span className="text-[#25D366]">
                    <span title="Delivered">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="-1.25 -1.25 27.50 27.50" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#888">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <path d="M5.03033 11.4697C4.73744 11.1768 4.26256 11.1768 3.96967 11.4697C3.67678 11.7626 3.67678 12.2374 3.96967 12.5303L5.03033 11.4697ZM8.5 16L7.96967 16.5303C8.26256 16.8232 8.73744 16.8232 9.03033 16.5303L8.5 16ZM17.0303 8.53033C17.3232 8.23744 17.3232 7.76256 17.0303 7.46967C16.7374 7.17678 16.2626 7.17678 15.9697 7.46967L17.0303 8.53033ZM9.03033 11.4697C8.73744 11.1768 8.26256 11.1768 7.96967 11.4697C7.67678 11.7626 7.67678 12.2374 7.96967 12.5303L9.03033 11.4697ZM12.5 16L11.9697 16.5303C12.2626 16.8232 12.7374 16.8232 13.0303 16.5303L12.5 16ZM21.0303 8.53033C21.3232 8.23744 21.3232 7.76256 21.0303 7.46967C20.7374 7.17678 20.2626 7.17678 19.9697 7.46967L21.0303 8.53033ZM3.96967 12.5303L7.96967 16.5303L9.03033 15.4697L5.03033 11.4697L3.96967 12.5303ZM9.03033 16.5303L17.0303 8.53033L15.9697 7.46967L7.96967 15.4697L9.03033 16.5303ZM7.96967 12.5303L11.9697 16.5303L13.0303 15.4697L9.03033 11.4697L7.96967 12.5303ZM13.0303 16.5303L21.0303 8.53033L19.9697 7.46967L11.9697 15.4697L13.0303 16.5303Z" fill="#888"></path>
                        </g>
                      </svg>
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400"><Clock className="w-5 h-5" /></span>
                )}
                <span className="text-[#111B21] dark:text-[#E9EDEF]">Delivered</span>
                <span className="ml-auto text-xs text-[#111B21] dark:text-[#E9EDEF]">{info.deliveredAt ? new Date(info.deliveredAt).toLocaleString() : "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                {info.seen ? (
                  <span className="text-[#075E54]"><span title="Seen"><svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="-1.25 -1.25 27.50 27.50" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#c105f5"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M5.03033 11.4697C4.73744 11.1768 4.26256 11.1768 3.96967 11.4697C3.67678 11.7626 3.67678 12.2374 3.96967 12.5303L5.03033 11.4697ZM8.5 16L7.96967 16.5303C8.26256 16.8232 8.73744 16.8232 9.03033 16.5303L8.5 16ZM17.0303 8.53033C17.3232 8.23744 17.3232 7.76256 17.0303 7.46967C16.7374 7.17678 16.2626 7.17678 15.9697 7.46967L17.0303 8.53033ZM9.03033 11.4697C8.73744 11.1768 8.26256 11.1768 7.96967 11.4697C7.67678 11.7626 7.67678 12.2374 7.96967 12.5303L9.03033 11.4697ZM12.5 16L11.9697 16.5303C12.2626 16.8232 12.7374 16.8232 13.0303 16.5303L12.5 16ZM21.0303 8.53033C21.3232 8.23744 21.3232 7.76256 21.0303 7.46967C20.7374 7.17678 20.2626 7.17678 19.9697 7.46967L21.0303 8.53033ZM3.96967 12.5303L7.96967 16.5303L9.03033 15.4697L5.03033 11.4697L3.96967 12.5303ZM9.03033 16.5303L17.0303 8.53033L15.9697 7.46967L7.96967 15.4697L9.03033 16.5303ZM7.96967 12.5303L11.9697 16.5303L13.0303 15.4697L9.03033 11.4697L7.96967 12.5303ZM13.0303 16.5303L21.0303 8.53033L19.9697 7.46967L11.9697 15.4697L13.0303 16.5303Z" fill="#2215d5"></path></g></svg></span></span>
                ) : (
                  <span className="text-gray-400"><Clock className="w-5 h-5" /></span>
                )}
                <span className="text-[#111B21] dark:text-[#E9EDEF]">Seen</span>
                <span className="ml-auto text-xs text-[#111B21] dark:text-[#E9EDEF]">{info.seenAt ? new Date(info.seenAt).toLocaleString() : "-"}</span>
              </div>
            </div>
            {info.readBy && info.readBy.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-[#075E54] dark:text-[#25D366]">Read by</h3>
                <ul>
                  {info.readBy.map(user => (
                    <li key={user._id} className="flex items-center gap-2 mb-1">
                      <img src={user.profilePic || '/avatar.png'} className="w-6 h-6 rounded-full border border-[#25D366]" />
                      <span className="text-[#111B21] dark:text-[#E9EDEF]">{user.fullName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button className="px-4 py-2 rounded bg-[#075E54] hover:bg-[#128C7E] text-white font-semibold transition" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
} 