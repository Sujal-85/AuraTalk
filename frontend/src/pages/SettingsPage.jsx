import { useChatStore } from '../store/useChatStore';
import { Settings, Trash2, Pencil, Image as ImageIcon, Check, Sparkles, Upload, User2, ChevronDown } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

const PREVIEW_MESSAGES = [
  {id: 1, content: "Hey! How's it going?", isSent: false},
  {id: 2, content: "I'm doing well, Just Working on some new features.! ", isSent: true},
];

const SettingsPage = () => {
  const {
    users,
    wallpaper,
    setWallpaper,
    clearWallpaper,
    wallpaperMode,
    setWallpaperMode,
    perUserWallpapers,
    setUserWallpaper,
    clearUserWallpaper,
    wallpaperLibrary,
    addWallpaperToLibrary,
    removeWallpaperFromLibrary,
    renameWallpaperInLibrary,
    updateWallpaperInLibrary,
    loadWallpaperPrefs,
  } = useChatStore();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const selectedUser = useMemo(() => users?.find(u => u._id === selectedUserId) || null, [users, selectedUserId]);
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!Array.isArray(users)) return [];
    return users.filter(u => u._id !== 'ai-bot' && (q ? u.fullName?.toLowerCase().includes(q) : true));
  }, [users, userQuery]);

  const PATTERNS = [
    { id: 'none', label: 'None', type: 'none', value: '' },
    // Use theme-aware color via DaisyUI's --bc (base-content) with transparency using color-mix
    // This makes patterns visible on both light and dark themes
    { id: 'soft-grid', label: 'Soft Grid', type: 'pattern', value: 'radial-gradient(circle at 1px 1px, color-mix(in oklch, oklch(var(--bc)) 14%, transparent) 1px, transparent 0) 0 0 / 24px 24px, var(--fallback-b1,oklch(var(--b1)))' },
    { id: 'diagonal', label: 'Diagonal', type: 'pattern', value: 'repeating-linear-gradient(135deg, color-mix(in oklch, oklch(var(--bc)) 12%, transparent) 0 10px, transparent 10px 20px), var(--fallback-b1,oklch(var(--b1)))' },
    { id: 'dots', label: 'Dots', type: 'pattern', value: 'radial-gradient(color-mix(in oklch, oklch(var(--bc)) 16%, transparent) 1px, transparent 1px) 0 0 / 14px 14px, var(--fallback-b1,oklch(var(--b1)))' },
    { id: 'wave', label: 'Wave', type: 'pattern', value: 'radial-gradient(100% 50% at 0% 0%, color-mix(in oklch, oklch(var(--bc)) 12%, transparent) 0%, transparent 50%), radial-gradient(100% 50% at 100% 0%, color-mix(in oklch, oklch(var(--bc)) 12%, transparent) 0%, transparent 50%), var(--fallback-b1,oklch(var(--b1)))' },
  ];

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const item = { type: 'image', value: reader.result, label: file.name };
      addWallpaperToLibrary(item);
      if (wallpaperMode === 'per-chat' && selectedUserId) setUserWallpaper(selectedUserId, item);
      else setWallpaper(item);
    };
    reader.readAsDataURL(file);
  };

  // Load persisted wallpaper prefs on first render
  useEffect(() => {
    loadWallpaperPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveWallpaper = (() => {
    if (wallpaperMode === 'per-chat' && selectedUserId) return perUserWallpapers?.[selectedUserId] || wallpaper;
    return wallpaper;
  })();

  return (
    <div className="w-full min-h-screen bg-base-100 container mx-auto px-3 sm:px-4 pt-20 pb-24 sm:pb-8 max-w-5xl select-none">
      <div className="space-y-4">
        {/* Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-base-300/60 bg-base-200/50">
          <div className="absolute inset-0 opacity-70" style={{
            background: 'radial-gradient(60% 60% at 0% 0%, color-mix(in oklch, oklch(var(--p)) 18%, transparent) 0%, transparent 100%), radial-gradient(60% 60% at 100% 0%, color-mix(in oklch, oklch(var(--s)) 16%, transparent) 0%, transparent 100%)'
          }} />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-base-100/70 backdrop-blur border border-base-300">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Settings</h2>
                <p className="text-sm text-base-content/70">Personalize your chat experience</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Wallpaper */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Chat Wallpaper</h2>
              <p className="text-sm text-base-content/70">Choose a wallpaper for your chat background</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn btn-sm btn-primary btn-outline cursor-pointer gap-2">
                <Upload className="w-4 h-4" />
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {wallpaperMode === 'per-chat' && selectedUserId ? (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => clearUserWallpaper(selectedUserId)}
                >
                  Reset
                </button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={() => clearWallpaper()}>Reset</button>
              )}
            </div>
          </div>

          {/* Wallpaper mode */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Apply wallpaper to</span>
            </div>
            <div className="join">
              <input className="join-item btn btn-sm btn-ghost border-base-300" type="radio" name="wp-scope" aria-label="All chats" checked={wallpaperMode === 'global'} onChange={() => setWallpaperMode('global')} />
              <input className="join-item btn btn-sm btn-ghost border-base-300" type="radio" name="wp-scope" aria-label="Per chat" checked={wallpaperMode === 'per-chat'} onChange={() => setWallpaperMode('per-chat')} />
            </div>
          </div>

          {/* Per-chat selector */}
          {wallpaperMode === 'per-chat' && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Combobox style dropdown */}
              <div className="dropdown dropdown-bottom">
                <div tabIndex={0} role="button" className="btn btn-sm btn-ghost border border-base-300 rounded-xl min-w-[200px] justify-between">
                  <div className="flex items-center gap-2 truncate">
                    {selectedUser ? (
                      <>
                        <img src={selectedUser.profilePic || '/avatar.png'} className="w-5 h-5 rounded-full object-cover" />
                        <span className="truncate max-w-[140px]">{selectedUser.fullName}</span>
                      </>
                    ) : (
                      <>
                        <User2 className="w-4 h-4" />
                        <span className="text-sm text-base-content/70">Select a chat...</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </div>
                <div tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-xl border border-base-300 w-64 sm:w-72">
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="input input-sm input-bordered w-full"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                  </div>
                  <ul className="max-h-64 overflow-y-auto">
                    {filteredUsers.map(u => (
                      <li key={u._id}>
                        <button
                          className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-base-200 w-full text-left ${selectedUserId===u._id ? 'bg-base-200' : ''}`}
                          onClick={() => { setSelectedUserId(u._id); setUserQuery(''); }}
                        >
                          <img src={u.profilePic || '/avatar.png'} className="w-6 h-6 rounded-full object-cover" />
                          <span className="truncate">{u.fullName}</span>
                        </button>
                      </li>
                    ))}
                    {filteredUsers.length === 0 && (
                      <li className="px-2 py-2 text-sm text-base-content/60">No users</li>
                    )}
                  </ul>
                </div>
              </div>
              {selectedUser && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-base-content/70">
                  <img src={selectedUser.profilePic || '/avatar.png'} className="w-6 h-6 rounded-full object-cover" />
                  <span className="truncate max-w-[160px]">{selectedUser.fullName}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Patterns */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  if (wallpaperMode === 'per-chat' && selectedUserId) {
                    setUserWallpaper(selectedUserId, { type: p.type, value: p.value });
                  } else {
                    setWallpaper({ type: p.type, value: p.value });
                  }
                }}
                className={`group relative rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-sm ${(() => {
                  if (wallpaperMode === 'per-chat' && selectedUserId) {
                    const w = perUserWallpapers?.[selectedUserId];
                    return w?.type === p.type && w?.value === p.value ? 'border-primary' : 'border-base-300 hover:border-base-200';
                  }
                  return wallpaper?.type === p.type && wallpaper?.value === p.value ? 'border-primary' : 'border-base-300 hover:border-base-200';
                })()}`}
                title={p.label}
              >
                <div
                  className="h-16 w-full"
                  style={p.type === 'pattern' ? { background: p.value } : {}}
                >
                  {p.type === 'none' && (
                    <div className="h-full w-full flex items-center justify-center text-xs text-base-content/60">None</div>
                  )}
                  {/* Selection overlay */}
                  {(() => {
                    const isSel = wallpaperMode === 'per-chat' && selectedUserId
                      ? (perUserWallpapers?.[selectedUserId]?.type === p.type && perUserWallpapers?.[selectedUserId]?.value === p.value)
                      : (wallpaper?.type === p.type && wallpaper?.value === p.value);
                    return isSel ? (
                      <div className="absolute inset-0 bg-primary/10 flex items-start justify-end p-1">
                        <div className="badge badge-primary badge-sm gap-1"><Check className="w-3 h-3" />Selected</div>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="px-2 py-1 text-[11px] truncate">{p.label}</div>
              </button>
            ))}
          </div>

          {/* Single Attractive Preview */}
          <div className="mt-3 rounded-2xl border border-base-300 bg-base-200/60 overflow-hidden">
            <div className="p-4">
              <div className="relative rounded-2xl shadow-lg overflow-hidden max-w-2xl mx-auto" style={(() => {
                const e = effectiveWallpaper;
                if (e?.type === 'image' && e?.value) return { backgroundImage: `url(${e.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
                if (e?.type === 'pattern' && e?.value) return { background: e.value };
                return { background: 'linear-gradient(135deg, rgba(0,0,0,0.06), transparent), var(--fallback-b1,oklch(var(--b1)))' };
              })()}>
                <div className="absolute inset-0 bg-gradient-to-b from-base-100/10 to-base-100/30 pointer-events-none" />
                <div className="relative">
                  <div className="px-4 py-3 border-b border-base-300/60 backdrop-blur bg-base-100/70">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content font-medium">J</div>
                      <div>
                        <h3 className="font-medium text-sm">John Doe</h3>
                        <p className="text-xs text-base-content/70">Online</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-4 min-h-[180px] max-h-[180px] sm:min-h-[220px] sm:max-h-[220px] overflow-y-auto">
                    {PREVIEW_MESSAGES.map((message) => (
                      <div key={message.id} className={`flex ${message.isSent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${message.isSent ? 'bg-primary text-primary-content' : 'bg-base-100/80 backdrop-blur'} border border-base-300/60`}>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-[10px] mt-1.5 ${message.isSent ? 'text-primary-content/70' : 'text-base-content/70'}`}>12:00 PM</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-base-300/60 backdrop-blur bg-base-100/70">
                    <div className="flex gap-2">
                      <input type="text" className="input input-bordered flex-1 text-sm h-10" placeholder="Type a message..." value="This is a preview" readOnly />
                      <button className="btn btn-primary h-10 min-h-0">
                        <Check className="w-4 h-4" />
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Saved Wallpapers Library */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Saved Wallpapers</h3>
              {wallpaperLibrary?.length ? (
                <div className="text-xs text-base-content/60">{wallpaperLibrary.length} saved</div>
              ) : null}
            </div>
            {wallpaperLibrary?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {wallpaperLibrary.map((w) => (
                  <div key={w.id} className="group rounded-xl overflow-hidden border border-base-300 bg-base-100 hover:shadow-sm transition-shadow">
                    <div className="h-24" style={w.type === 'image' ? { backgroundImage: `url(${w.value})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: w.value }} />
                    <div className="p-2 flex items-center justify-between gap-2">
                      <input
                        className="input input-ghost input-xs px-2 h-8 flex-1"
                        value={w.label || ''}
                        placeholder="Name..."
                        onChange={(e) => renameWallpaperInLibrary(w.id, e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <label className="btn btn-xs btn-ghost" title="Replace image">
                          <ImageIcon className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const r = new FileReader();
                            r.onload = () => updateWallpaperInLibrary(w.id, r.result);
                            r.readAsDataURL(f);
                          }} />
                        </label>
                        <button className="btn btn-xs btn-ghost text-error" title="Delete" onClick={() => removeWallpaperFromLibrary(w.id)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => {
                            if (wallpaperMode === 'per-chat' && selectedUserId) setUserWallpaper(selectedUserId, { type: w.type, value: w.value });
                            else setWallpaper({ type: w.type, value: w.value });
                          }}
                          title="Apply"
                        >Apply</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-base-300 p-6 text-center bg-base-200/40">
                <p className="text-sm text-base-content/70">No saved wallpapers yet.</p>
                <div className="mt-3">
                  <label className="btn btn-sm btn-primary btn-outline cursor-pointer gap-2">
                    <Upload className="w-4 h-4" />
                    Upload a wallpaper
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Theme preview remains on Theme page; single preview shown above */}
      </div>
    </div>
  );
};

export default SettingsPage;
