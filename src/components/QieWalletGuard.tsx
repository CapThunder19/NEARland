'use client';

import React, { useEffect, useState } from 'react';

interface QieWalletGuardProps {
  children: React.ReactNode;
}

export default function QieWalletGuard({ children }: QieWalletGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [hasQie, setHasQie] = useState(false);
  const [bypass, setBypass] = useState(false);

  useEffect(() => {
    // Check for query param or local storage bypass
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('bypass') === 'true') {
        localStorage.setItem('bypassQieCheck', 'true');
        setBypass(true);
        setIsChecking(false);
        return;
      }

      if (localStorage.getItem('bypassQieCheck') === 'true') {
        setBypass(true);
        setIsChecking(false);
        return;
      }
    }

    // Function to search for QIE Wallet injected signals
    const checkWallet = () => {
      const win = window as any;
      const qiePresent = 
        !!win.qie || 
        !!win.ethereum?.isQieWallet || 
        !!win.ethereum?.isQie ||
        (win.ethereum?.providers?.some((p: any) => p.isQie || p.isQieWallet)) ||
        navigator.userAgent.toLowerCase().includes('qiewallet');
      
      if (qiePresent) {
        setHasQie(true);
        setIsChecking(false);
        return true;
      }
      return false;
    };

    // First attempt immediately on mount
    if (checkWallet()) return;

    // Retry checking periodically (up to 800ms) to account for injection latency
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (checkWallet() || attempts >= 8) {
        clearInterval(interval);
        setIsChecking(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleBypass = () => {
    localStorage.setItem('bypassQieCheck', 'true');
    setBypass(true);
  };

  if (bypass || hasQie) {
    return <>{children}</>;
  }

  if (isChecking) {
    return (
      <div className="qie-guard-loading">
        <div className="qie-guard-spinner"></div>
        <p>INITIALIZING ON-CHAIN INTERFACE...</p>
      </div>
    );
  }

  return (
    <div className="qie-guard-overlay">
      <div className="qie-guard-card">
        <div className="qie-guard-warning-strip"></div>
        <div className="qie-guard-icon-wrap">
          <svg className="qie-guard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="qie-guard-title">ACCESS RESTRICTED</h1>
        <h2 className="qie-guard-subtitle">QIE WALLET ENVIRONMENT REQUIRED</h2>
        <p className="qie-guard-text">
          QuantumQie is an on-chain game integrated with the <strong>QIE Mainnet</strong>. 
          To play this game, establish connections, and protect your digital assets, you must open it 
          inside the QIE Wallet browser extension or its built-in mobile dApp browser.
        </p>
        
        <div className="qie-guard-actions">
          <a href="https://qiewallet.me" target="_blank" rel="noopener noreferrer" className="qie-guard-btn-primary">
            DOWNLOAD QIE WALLET
            <span className="btn-glow" />
          </a>
          
          {process.env.NODE_ENV === 'development' && (
            <button onClick={handleBypass} className="qie-guard-btn-secondary">
              BYPASS CHECK (DEV ONLY)
            </button>
          )}
        </div>
        
        <div className="qie-guard-status">
          <span className="qie-guard-status-dot"></span>
          <span>WAITING FOR DETECTOR PING...</span>
        </div>
      </div>
    </div>
  );
}
