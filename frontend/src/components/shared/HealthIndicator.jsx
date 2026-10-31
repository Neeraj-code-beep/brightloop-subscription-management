import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function HealthIndicator() {
  const [healthStatus, setHealthStatus] = useState('checking');
  const [message, setMessage] = useState('Connecting to backend...');

  useEffect(() => {
    let isMounted = true;
    apiClient.get('/health')
      .then((res) => {
        if (isMounted) {
          setHealthStatus('connected');
          setMessage(`Connected (${res.data?.status || 'OK'})`);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHealthStatus('disconnected');
          setMessage('Backend offline or unreachable');
        }
      });

    return () => { isMounted = false; };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full border bg-white shadow-sm">
      {healthStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
      {healthStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
      {healthStatus === 'disconnected' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
      <span className="font-medium text-gray-700">{message}</span>
    </div>
  );
}

