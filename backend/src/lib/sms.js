import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client only if credentials are available
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  try {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio SMS service initialized successfully');
  } catch (error) {
    console.log('Failed to initialize Twilio SMS service:', error.message);
    client = null;
  }
} else {
  console.log('Twilio SMS service not configured - SMS features will be disabled');
}

// Send verification code via SMS
export const sendVerificationSMS = async (phoneNumber, verificationCode, fullName) => {
  if (!client) {
    console.log('SMS service not available - verification code not sent');
    return false;
  }

  try {
    const message = await client.messages.create({
      body: `Hello ${fullName}! Your Chat App verification code is: ${verificationCode}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log('Verification SMS sent:', message.sid);
    return true;
  } catch (error) {
    console.error('Error sending verification SMS:', error);
    return false;
  }
};

// Send notification SMS
export const sendNotificationSMS = async (phoneNumber, message, fullName) => {
  if (!client) {
    console.log('SMS service not available - notification not sent');
    return false;
  }

  try {
    const smsMessage = await client.messages.create({
      body: `Hello ${fullName}! ${message}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log('Notification SMS sent:', smsMessage.sid);
    return true;
  } catch (error) {
    console.error('Error sending notification SMS:', error);
    return false;
  }
};

// Send chat notification SMS
export const sendChatNotificationSMS = async (phoneNumber, senderName, messagePreview, fullName) => {
  if (!client) {
    console.log('SMS service not available - chat notification not sent');
    return false;
  }

  try {
    const truncatedMessage = messagePreview.length > 50 
      ? messagePreview.substring(0, 50) + '...' 
      : messagePreview;

    const smsMessage = await client.messages.create({
      body: `New message from ${senderName}: "${truncatedMessage}"`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log('Chat notification SMS sent:', smsMessage.sid);
    return true;
  } catch (error) {
    console.error('Error sending chat notification SMS:', error);
    return false;
  }
};

// Send call notification SMS
export const sendCallNotificationSMS = async (phoneNumber, callerName, callType, fullName) => {
  if (!client) {
    console.log('SMS service not available - call notification not sent');
    return false;
  }

  try {
    const callTypeText = callType === 'video' ? 'video call' : 'voice call';
    
    const smsMessage = await client.messages.create({
      body: `Missed ${callTypeText} from ${callerName}. Check your Chat App for details.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log('Call notification SMS sent:', smsMessage.sid);
    return true;
  } catch (error) {
    console.error('Error sending call notification SMS:', error);
    return false;
  }
};
