# Chat App Backend

This is the backend for the WhatsApp-like chat application with media sharing capabilities.

## Features

- Real-time messaging using Socket.IO
- Image, video, and audio file sharing
- Cloudinary integration for media storage
- User authentication and authorization
- Message history and user management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory with the following variables:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

3. Set up Cloudinary:
   - Sign up at [Cloudinary](https://cloudinary.com/)
   - Get your cloud name, API key, and API secret from your dashboard
   - Add them to your `.env` file

4. Start the server:
```bash
npm start
```

## Media Upload Features

The backend supports WhatsApp-like media sharing:

- **Images**: JPEG, PNG, GIF (max 10MB)
- **Videos**: MP4, WebM, MOV (max 50MB)
- **Audio**: WebM, MP3, WAV (max 10MB)

All media files are automatically uploaded to Cloudinary and stored securely.

## API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/messages/users` - Get users for sidebar
- `GET /api/messages/:id` - Get messages with a user
- `POST /api/messages/send/:id` - Send a message (supports text, image, video, audio)

## Socket Events

- `newMessage` - Emitted when a new message is sent
- `userConnected` - Emitted when a user connects
- `userDisconnected` - Emitted when a user disconnects 