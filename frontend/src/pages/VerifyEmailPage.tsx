import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('Verifying…');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setMessage('Missing verification token.');
      return;
    }
    authAPI.verifyEmail(token)
      .then(() => setMessage('Email verified. You can sign in.'))
      .catch((err: any) => setMessage(err?.response?.data?.error || 'Verification failed'));
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card max-w-md">{message}</div>
    </div>
  );
}
