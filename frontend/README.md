# Chat App Frontend

A modern, responsive chat application built with React and Vite, featuring WhatsApp-like media sharing capabilities.

## Features

- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Media Sharing**: Send images, videos, and audio messages
- **WhatsApp-like UI**: Familiar interface with modern design
- **File Previews**: Preview media before sending
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: Toggle between themes
- **Emoji Support**: Built-in emoji picker
- **Voice Messages**: Record and send audio messages
- **File Downloads**: Download shared media files

## Media Sharing Features

### Image Sharing
- Support for JPEG, PNG, GIF formats
- File size limit: 10MB
- Preview before sending
- Click to view full size
- Download option

### Video Sharing
- Support for MP4, WebM, MOV formats
- File size limit: 50MB
- Video preview with controls
- Download option

### Audio Sharing
- Voice message recording
- WebM format support
- Audio player controls
- Download option

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

### Sending Media Files
1. Click the paperclip icon to attach files
2. Select an image or video file
3. Preview the file in the input area
4. Add optional text message
5. Click send to upload and share

### Recording Voice Messages
1. Click the microphone icon to start recording
2. Speak your message
3. Click the microphone again to stop recording
4. Preview the audio
5. Click send to share

### Keyboard Shortcuts
- `Ctrl + E`: Open emoji picker
- `Enter`: Send message (when text is entered)
- `Shift + Enter`: New line in text input

## Technologies Used

- **React 18** with Vite
- **Zustand** for state management
- **Socket.IO** for real-time communication
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications
- **Emoji Mart** for emoji picker

## File Structure

```
src/
├── components/          # React components
│   ├── MessageInput.jsx # Message input with media support
│   ├── ChatContainer.jsx # Chat display with media messages
│   └── ...
├── store/              # Zustand stores
├── lib/                # Utility functions
├── pages/              # Page components
└── ...
```

## Media Handling

The app handles media files in a WhatsApp-like manner:

1. **Selection**: Choose file from device
2. **Preview**: Show preview in input area
3. **Upload**: Send to Cloudinary via backend
4. **Display**: Show in chat with download options
5. **Cleanup**: Remove preview after sending

All media is stored securely on Cloudinary and served via CDN for fast loading.
