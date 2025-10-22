import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { FaEnvelope, FaCheckCircle, FaExclamationTriangle, FaPaperPlane } from 'react-icons/fa';

const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resendVerificationEmail, isSendingVerification, authUser, setVerifyEmailModal, checkAuth } = useAuthStore();
  
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [emailInput, setEmailInput] = useState('');
  const email = useMemo(() => emailInput || authUser?.email || '', [emailInput, authUser]);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const qpEmail = searchParams.get('email');
    if (qpEmail) setEmailInput(qpEmail);
    
    // If there's a token, verify the email
    if (token) {
      verifyEmail(token);
    } else {
      // If no token, check if user is already verified
      if (authUser?.isEmailVerified) {
        setVerificationStatus('success');
      } else if (qpEmail) {
        // If there's an email but no token, show pending state for new signup
        setVerificationStatus('pending');
      } else {
        setVerificationStatus('error');
      }
    }
  }, [searchParams, authUser?.isEmailVerified]);

  // Auto-redirect when user is verified
  useEffect(() => {
    if (authUser?.isEmailVerified && verificationStatus === 'success') {
      // Auto-redirect to messages after 3 seconds
      const timer = setTimeout(() => {
        navigate('/messages');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authUser?.isEmailVerified, verificationStatus, navigate]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(`http://localhost:5001/api/auth/verify-email/${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setVerificationStatus('success');
        setEmailInput(data.user.email);
        // Refresh auth state to update verification status
        try { 
          await checkAuth(); 
          // Force a small delay to ensure state is updated
          setTimeout(() => {
            checkAuth();
          }, 1000);
        } catch {}
      } else {
        setVerificationStatus('error');
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      setVerificationStatus('error');
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setIsResending(true);
    const result = await resendVerificationEmail(email);
    setIsResending(false);
    if (result?.alreadyVerified) {
      setVerificationStatus('success');
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const openMailboxLink = () => {
    const e = (email || '').toLowerCase();
    if (!e) return window.open('https://mail.google.com', '_blank');
    if (e.endsWith('@gmail.com')) return window.open('https://mail.google.com', '_blank');
    if (e.endsWith('@outlook.com') || e.endsWith('@hotmail.com') || e.endsWith('@live.com')) return window.open('https://outlook.live.com/mail', '_blank');
    if (e.endsWith('@yahoo.com')) return window.open('https://mail.yahoo.com', '_blank');
    const domain = e.includes('@') ? e.split('@')[1] : '';
    if (domain) window.open('https://mail.' + domain, '_blank');
    else window.open('https://mail.google.com', '_blank');
  };

  if (verificationStatus === 'pending') {
    const hasToken = searchParams.get('token');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          {hasToken ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Verifying Your Email</h2>
              <p className="text-gray-600">Please wait while we verify your email address...</p>
            </>
          ) : (
            <>
              <div className="bg-blue-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
                <FaEnvelope className="text-6xl text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Check Your Email</h2>
              <p className="text-gray-600 mb-6">
                We've sent a verification link to <span className="font-semibold">{email}</span>. 
                Please check your inbox and click the link to verify your account.
              </p>
              <div className="space-y-3">
                <button
                  onClick={openMailboxLink}
                  className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200"
                >
                  Open Email App
                </button>
                <button
                  onClick={handleResendVerification}
                  disabled={!email || isResending}
                  className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                <button
                  onClick={handleGoToLogin}
                  className="w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors duration-200"
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
            <FaCheckCircle className="text-6xl text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Email Verified Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your email address <span className="font-semibold">{email}</span> has been verified. 
            You can now use all features of the app.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/messages')}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200"
            >
              Go to App
            </button>
            <button
              onClick={handleGoToLogin}
              className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="bg-red-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
            <FaExclamationTriangle className="text-6xl text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Verification Failed</h2>
          <p className="text-gray-600 mb-6">
            The verification link is invalid or has expired. Please request a new verification email.
          </p>
          
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Enter your email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={handleResendVerification}
            disabled={!email || isResending}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={openMailboxLink}
            className="w-full bg-gray-100 text-gray-900 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors duration-200 mb-4"
          >
            Open Email App
          </button>
          
          <button
            onClick={handleGoToLogin}
            className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default EmailVerificationPage;
