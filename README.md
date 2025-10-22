# Chat App with Email Authentication & Mobile Notifications

A modern real-time chat application built with MERN stack, featuring email verification, mobile number verification, and SMS notifications.

## Features

### 🔐 Authentication & Security
- **Email Verification**: Users must verify their email before logging in
- **Password Reset**: Secure password reset via email
- **Mobile Verification**: Optional mobile number verification for SMS notifications
- **JWT Authentication**: Secure token-based authentication
- **Google OAuth**: Sign in with Google account

### 📱 Notifications
- **Email Notifications**: Welcome emails, verification emails, password reset emails
- **SMS Notifications**: Real-time SMS alerts for new messages and calls
- **Customizable Preferences**: Users can control email and SMS notification settings

### 💬 Chat Features
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Voice & Video Calls**: WebRTC-based calling functionality
- **File Sharing**: Support for images and documents
- **Message Encryption**: End-to-end encryption for secure communication
- **Chat Wallpapers**: Customizable chat backgrounds

### 🎨 User Experience
- **Responsive Design**: Works on desktop and mobile devices
- **Theme Support**: Multiple color themes and dark/light mode
- **Profile Management**: User profile customization
- **Archive System**: Message archiving and management

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **Nodemailer** for email services
- **Twilio** for SMS services
- **Cloudinary** for file storage

### Frontend
- **React.js** with modern hooks
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Socket.IO Client** for real-time features

## Prerequisites

Before running this application, make sure you have:

- **Node.js** (v16 or higher)
- **MongoDB** (local or cloud instance)
- **Gmail Account** (for email services)
- **Twilio Account** (for SMS services)
- **Cloudinary Account** (for file storage)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd chat-app
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

#### Backend Environment Variables
Create a `.env` file in the `backend` directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/chat-app

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Server Configuration
PORT=5001
NODE_ENV=development
```

#### Gmail Setup
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password in `EMAIL_PASSWORD`

#### Twilio Setup
1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number for SMS services
4. Add these credentials to your `.env` file

#### Cloudinary Setup
1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com)
2. Get your cloud name, API key, and API secret
3. Add these credentials to your `.env` file

### 4. Database Setup
Make sure MongoDB is running and accessible. The application will automatically create the necessary collections.

### 5. Start the Application

#### Development Mode
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

#### Production Mode
```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status
- `GET /api/auth/verify-email/:token` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Mobile Verification
- `POST /api/auth/send-mobile-verification` - Send SMS verification code
- `POST /api/auth/verify-mobile` - Verify mobile number
- `PUT /api/auth/notification-preferences` - Update notification settings

### User Management
- `PUT /api/auth/update-profile` - Update user profile
- `PUT /api/auth/update-password` - Update password
- `PUT /api/auth/update-public-key` - Update encryption public key

### Chat & Messages
- `GET /api/messages/:userId` - Get chat messages
- `POST /api/messages` - Send message
- `DELETE /api/messages/:messageId` - Delete message

## Usage

### 1. User Registration
1. Navigate to `/signup`
2. Fill in your details including optional mobile number
3. Check your email for verification link
4. Click the verification link to activate your account

### 2. Mobile Verification (Optional)
1. After login, go to Settings
2. Add your mobile number
3. Enter the 6-digit verification code sent via SMS
4. Enable SMS notifications for real-time alerts

### 3. Password Reset
1. Click "Forgot password?" on the login page
2. Enter your email address
3. Check your email for reset link
4. Set a new password

### 4. Chat Features
1. Start conversations with other users
2. Send text messages, images, and files
3. Make voice or video calls
4. Customize chat wallpapers
5. Archive important conversations

## Security Features

- **Email Verification**: Prevents fake accounts
- **Password Requirements**: Minimum 8 characters with complexity
- **JWT Tokens**: Secure session management
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: Protection against brute force attacks
- **HTTPS**: Secure communication (in production)

## Notification System

### Email Notifications
- Welcome emails after verification
- Password reset instructions
- Account security alerts

### SMS Notifications
- New message alerts
- Missed call notifications
- Account verification codes
- Custom notification preferences

## Troubleshooting

### Common Issues

#### Email Not Sending
- Check Gmail app password configuration
- Verify email credentials in `.env`
- Check spam folder for verification emails

#### SMS Not Working
- Verify Twilio credentials
- Check phone number format (include country code)
- Ensure Twilio account has sufficient credits

#### Database Connection Issues
- Verify MongoDB is running
- Check connection string in `.env`
- Ensure network access to database

#### Frontend Build Issues
- Clear `node_modules` and reinstall
- Check Node.js version compatibility
- Verify all environment variables are set

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

## Roadmap

- [ ] Push notifications for mobile apps
- [ ] Group chat functionality
- [ ] Message reactions and replies
- [ ] Advanced search and filtering
- [ ] Message encryption improvements
- [ ] Multi-language support
- [ ] Voice message support
- [ ] Screen sharing in video calls
