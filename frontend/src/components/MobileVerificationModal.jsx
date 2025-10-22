import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { FaMobile, FaTimes, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const MobileVerificationModal = ({ isOpen, onClose, onSuccess }) => {
  const { sendMobileVerification, verifyMobile, isSendingMobileVerification, isVerifyingMobile } = useAuthStore();
  
  const [step, setStep] = useState('input'); // 'input', 'verification', 'success'
  const [mobileNumber, setMobileNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendVerification = async (e) => {
    e.preventDefault();
    
    if (!mobileNumber) {
      setError('Please enter your mobile number');
      return;
    }

    // Basic mobile number validation
    const mobileRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!mobileRegex.test(mobileNumber)) {
      setError('Please enter a valid mobile number');
      return;
    }

    setError('');
    const success = await sendMobileVerification(mobileNumber);
    
    if (success) {
      setStep('verification');
      setMessage('Verification code sent to your mobile number');
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    setError('');
    const success = await verifyMobile(verificationCode);
    
    if (success) {
      setStep('success');
      setMessage('Mobile number verified successfully!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    }
  };

  const handleResendCode = async () => {
    setError('');
    const success = await sendMobileVerification(mobileNumber);
    
    if (success) {
      setMessage('New verification code sent!');
      setVerificationCode('');
    }
  };

  const handleClose = () => {
    if (step === 'input') {
      onClose();
    } else {
      setStep('input');
      setMobileNumber('');
      setVerificationCode('');
      setMessage('');
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Mobile Verification</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'input' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                  <FaMobile className="text-4xl text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Mobile Number</h3>
                <p className="text-gray-600">Add your mobile number to receive SMS notifications for new messages and calls.</p>
              </div>

              <form onSubmit={handleSendVerification} className="space-y-4">
                <div>
                  <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    id="mobileNumber"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code for international numbers</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSendingMobileVerification}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingMobileVerification ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            </div>
          )}

          {step === 'verification' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="bg-orange-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                  <FaMobile className="text-4xl text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Enter Verification Code</h3>
                <p className="text-gray-600">
                  We've sent a 6-digit verification code to <span className="font-semibold">{mobileNumber}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingMobile}
                  className="w-full bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifyingMobile ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>

              <div className="text-center">
                <button
                  onClick={handleResendCode}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Didn't receive the code? Resend
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto">
                <FaCheckCircle className="text-6xl text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Mobile Number Verified!</h3>
                <p className="text-gray-600">
                  Your mobile number <span className="font-semibold">{mobileNumber}</span> has been successfully verified.
                  You'll now receive SMS notifications for new messages and calls.
                </p>
              </div>
              
              {message && (
                <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm">
                  {message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileVerificationModal;
