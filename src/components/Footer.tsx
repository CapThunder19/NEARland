"use client";
import React, { useEffect } from 'react';
import { gsap } from 'gsap';

const ASSETS = [
  '/assets/debug/cabbage_a.png',
  '/assets/debug/carrot_a.png',
  '/assets/debug/corn_a.png',
  '/assets/debug/corn_b.png',
];

import { useRouter } from 'next/navigation';

const Footer = () => {
  const router = useRouter();
  useEffect(() => {
    // Gentle bobbing for the small pixel icons
    gsap.utils.toArray('.footer .pixel-sprite').forEach((el: any, i: number) => {
      gsap.to(el, {
        y: '-=10',
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.25,
        duration: 2 + i * 0.3,
      });
    });
  }, []);

  const handleStart = () => {
    router.push('/game');
  };

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner footer-hero">
        <div className="footer-decor-lines"></div>
        <div className="footer-center-row">
          <div className="hero-brand" data-text="QuantumQie">QuantumQie</div>
          <div className="footer-actions-main">
            <button className="btn-start" onClick={handleStart}>
              <div className="btn-glow"></div>
              INITIALIZE CONSTRUCTOR
            </button>
          </div>
        </div>

        <div className="footer-legal-row">
          <div className="footer-brand-mini-container">
            <div className="status-dot"></div>
            <div className="footer-brand-mini">QuantumQie © {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
