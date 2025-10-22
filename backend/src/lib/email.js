import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter for sending emails via Gmail SMTP only if credentials are available
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  try {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for port 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // App-specific password required
      },
    });
    console.log('Email service initialized successfully');
  } catch (error) {
    console.log('Failed to initialize email service:', error.message);
    transporter = null;
  }
} else {
  console.log('Email service not configured - email features will be disabled');
}

// Email verification template
export const sendVerificationEmail = async (email, verificationToken, fullName) => {
  if (!transporter) {
    console.log('Email service not available - verification email not sent');
    return false;
  }

  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `AuraTalk <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - AuraTalk',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <h1>Welcome to AuraTalk!</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${fullName},</h2>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div style="background: #333; color: white; padding: 20px; text-align: center;">
            <p>&copy; 2025 AuraTalk. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

// Password reset email
export const sendPasswordResetEmail = async (email, resetToken, fullName) => {
  if (!transporter) {
    console.log('Email service not available - password reset email not sent');
    return false;
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `AuraTalk <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - AuraTalk',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 20px; text-align: center; color: white;">
            <h1>Password Reset Request</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${fullName},</h2>
            <p>You requested a password reset. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #ff6b6b;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          </div>
          <div style="background: #333; color: white; padding: 20px; text-align: center;">
            <p>&copy; 2024 Chat App. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Welcome email after verification
export const sendWelcomeEmail = async (email, fullName) => {
  if (!transporter) {
    console.log('Email service not available - welcome email not sent');
    return false;
  }

  try {
    const mailOptions = {
      from: `AuraTalk<${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to AuraTalk!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 20px; text-align: center; color: white;">
            <h1>🎉 Welcome to AuraTalk!</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>Hello ${fullName},</h2>
            <p>Your email has been successfully verified! You can now enjoy all the features of our chat application.</p>
            <div style="background: #e8f5e8; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
              <h3>What's next?</h3>
              <ul>
                <li>Complete your profile</li>
                <li>Add your mobile number for SMS notifications</li>
                <li>Start chatting with friends</li>
                <li>Customize your chat experience</li>
              </ul>
            </div>
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
          <div style="background: #333; color: white; padding: 20px; text-align: center;">
            <p>&copy; 2025 AuraTalk. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};
