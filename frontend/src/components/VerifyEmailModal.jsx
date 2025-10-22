import React, { useMemo, useState, useEffect } from 'react';
import { FaEnvelope, FaPaperPlane, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { useAuthStore } from '../store/useAuthStore';

const VerifyEmailModal = () => {
    const { verifyEmailModalOpen, verifyEmailAddress, setVerifyEmailModal, resendVerificationEmail, isSendingVerification, checkAuth, authUser } = useAuthStore();
    const [email, setEmail] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('pending'); // 'pending', 'success', 'error'
    const effectiveEmail = useMemo(() => email || verifyEmailAddress || '', [email, verifyEmailAddress]);

    // Check if user is verified when modal opens
    useEffect(() => {
        if (verifyEmailModalOpen && authUser?.isEmailVerified) {
            setVerificationStatus('success');
        } else if (verifyEmailModalOpen) {
            setVerificationStatus('pending');
        }
    }, [verifyEmailModalOpen, authUser?.isEmailVerified]);

    // Periodically check verification status when modal is open
    useEffect(() => {
        if (verifyEmailModalOpen && verificationStatus === 'pending') {
            const interval = setInterval(async () => {
                try {
                    const result = await checkAuth();
                    if (result?.isEmailVerified) {
                        setVerificationStatus('success');
                        clearInterval(interval);
                    }
                } catch (error) {
                    // Ignore errors in periodic check
                }
            }, 3000); // Check every 3 seconds
            
            return () => clearInterval(interval);
        }
    }, [verifyEmailModalOpen, verificationStatus, checkAuth]);

    if (!verifyEmailModalOpen) return null;

    const openMailboxLink = () => {
        const e = effectiveEmail.toLowerCase();
        if (!e) return window.open('https://mail.google.com', '_blank');
        if (e.endsWith('@gmail.com')) return window.open('https://mail.google.com', '_blank');
        if (e.endsWith('@outlook.com') || e.endsWith('@hotmail.com') || e.endsWith('@live.com')) return window.open('https://outlook.live.com/mail', '_blank');
        if (e.endsWith('@yahoo.com')) return window.open('https://mail.yahoo.com', '_blank');
        const domain = e.includes('@') ? e.split('@')[1] : '';
        if (domain) window.open('https://mail.' + domain, '_blank');
        else window.open('https://mail.google.com', '_blank');
    };

    const handleResend = async () => {
        if (!effectiveEmail) return;
        const result = await resendVerificationEmail(effectiveEmail);
        if (result?.alreadyVerified) {
            setVerificationStatus('success');
        }
    };

    const handleCheckVerification = async () => {
        setIsChecking(true);
        try {
            const result = await checkAuth();
            if (result?.isEmailVerified) {
                setVerificationStatus('success');
                // Close modal after a short delay to show success state
                setTimeout(() => {
                    setVerifyEmailModal(false);
                }, 2000);
            } else {
                setVerificationStatus('error');
            }
        } catch (error) {
            setVerificationStatus('error');
        } finally {
            setIsChecking(false);
        }
    };

    // Success state
    if (verificationStatus === 'success') {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="text-lg font-semibold">Email Verified!</h3>
                        <button className="text-gray-500 hover:text-gray-800" onClick={() => setVerifyEmailModal(false)} aria-label="Close">
                            <FaTimes />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 text-center">
                        <div className="flex items-center justify-center">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                <FaCheckCircle className="text-green-600 text-3xl" />
                            </div>
                        </div>
                        <div>
                            <div className="font-medium text-lg text-green-800">Email verification successful!</div>
                            <div className="text-sm text-gray-600 mt-2">Your email address has been verified. You can now use all features of the app.</div>
                        </div>
                        <button
                            onClick={() => setVerifyEmailModal(false)}
                            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (verificationStatus === 'error') {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="text-lg font-semibold">Verification Failed</h3>
                        <button className="text-gray-500 hover:text-gray-800" onClick={() => setVerifyEmailModal(false)} aria-label="Close">
                            <FaTimes />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="text-center">
                            <div className="font-medium text-red-800">Verification link is invalid or expired</div>
                            <div className="text-sm text-gray-600 mt-2">Please request a new verification email.</div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-700 mb-1">Email address</label>
                            <input
                                type="email"
                                value={effectiveEmail}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={openMailboxLink}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white py-2 px-3 hover:bg-indigo-700"
                            >
                                Go to Email
                            </button>
                            <button
                                onClick={handleResend}
                                disabled={!effectiveEmail || isSendingVerification}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-900 py-2 px-3 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaPaperPlane /> {isSendingVerification ? 'Sending…' : 'Resend Link'}
                            </button>
                        </div>

                        <button
                            onClick={handleCheckVerification}
                            disabled={isChecking}
                            className="w-full mt-2 rounded-lg border py-2 px-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isChecking ? 'Checking...' : 'I\'ve verified – Refresh status'}
                        </button>

                        <p className="text-xs text-gray-500">Didn't get the email? Check your spam folder or resend the link.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Default pending state
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Verify your email</h3>
                    <button className="text-gray-500 hover:text-gray-800" onClick={() => setVerifyEmailModal(false)} aria-label="Close">
                        <FaTimes />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                            <FaEnvelope className="text-indigo-600 text-xl" />
                        </div>
                        <div>
                            <div className="font-medium">Check your inbox to verify your email address</div>
                            <div className="text-sm text-gray-600">We sent a verification link to your email. Click it to continue.</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-700 mb-1">Email address</label>
                        <input
                            type="email"
                            value={effectiveEmail}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={openMailboxLink}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white py-2 px-3 hover:bg-indigo-700"
                        >
                            Go to Email
                        </button>
                        <button
                            onClick={handleResend}
                            disabled={!effectiveEmail || isSendingVerification}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-900 py-2 px-3 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaPaperPlane /> {isSendingVerification ? 'Sending…' : 'Resend Link'}
                        </button>
                    </div>

                    <button
                        onClick={handleCheckVerification}
                        disabled={isChecking}
                        className="w-full mt-2 rounded-lg border py-2 px-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isChecking ? 'Checking...' : 'I\'ve verified – Refresh status'}
                    </button>

                    <p className="text-xs text-gray-500">Didn't get the email? Check your spam folder or resend the link.</p>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailModal;


