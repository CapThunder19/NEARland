'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import WalletButton from '../components/WalletButton';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './landing.css';
import Footer from '../components/Footer';

gsap.registerPlugin(ScrollTrigger);

// Page data (three "sectors") – only the first uses farming_sunset.png, the others use the
// cleaned images you provided earlier.
// ---------------------------------------------------------------------------
const SECTORS = [
  {
    id: 'hero',
    bg: '/assets/farming_sunset.png',
    title: 'HARVEST THE FUTURE',
    subtitle: 'Build. Mine. Dominate.',
    subtitle2: 'Your pixel empire awaits on‑chain.',
    description: '',
    showButton: true,
  },
  {
    id: 'features',
    bg: '',
    title: 'CORE SYSTEMS',
    subtitle: 'What Powers Your World',
    description: '',
    showButton: false,
  },
  {
    id: 'mining',
    bg: '/assets/img2.jpg',
    title: 'FARMSTEADS',
    subtitle: 'SUSTAINABLE AGRICULTURE • RENEW',
    description: 'Cultivate crops, rotate fields, and build an automated food economy for your settlement.',
    showButton: false,
  },
];

const FEATURES = [
  { sprite: '/assets/debug/corn_a.png',         title: 'Resource Mining',      desc: 'Dig deep for ores, gems & rare minerals to fuel your empire.' },
  { sprite: '/assets/debug/cabbage_a.png',       title: 'Farm & Harvest',       desc: 'Plant crops, manage workers, and automate your food supply.' },
  { sprite: '/assets/ironmine.png',              title: 'Base Building',        desc: 'Place structures on a canvas grid and expand your settlement.' },
  { sprite: '/assets/diamondmine.png',           title: 'On‑Chain Persistence', desc: 'Your world is saved to Supabase — pick up right where you left off.' },
];

// PAGE2_SPRITES removed — small floating boxes disabled per UI request
const PAGE2_SPRITES: any[] = [];

// ---------------------------------------------------------------------------
// Helper – create a few animated loot sprites for the lower pages.
// ---------------------------------------------------------------------------
const LOOT_ASSETS = [
  '/assets/debug/cabbage_a.png',
  '/assets/debug/carrot_a.png',
  '/assets/debug/corn_a.png',
  '/assets/debug/farm-potato.png',
  '/assets/debug/farm-rice.png',
  '/assets/debug/farm-wheat.png',
];

const spawnLoot = (container: HTMLElement) => {
  const { clientWidth, clientHeight } = container;
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'game-loot-item';
    el.style.backgroundImage = `url(${LOOT_ASSETS[Math.floor(Math.random() * LOOT_ASSETS.length)]})`;
    const size = Math.floor(Math.random() * 24 + 32);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    const startX = Math.random() * clientWidth;
    const startY = clientHeight + Math.random() * 150;
    el.style.left = `${startX}px`;
    el.style.bottom = `${-size}px`;
    container.appendChild(el);
    gsap.to(el, {
      y: -(clientHeight + 200),
      x: `+=${Math.random() * 80 - 40}`,
      rotation: Math.random() * 360,
      duration: Math.random() * 6 + 4,
      repeat: -1,
      delay: Math.random() * 3,
      ease: 'none',
    });
  }
};

// ---------------------------------------------------------------------------
// Main component – a full‑height scroll‑snap container that houses three pages.
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Simulate loading progress
  useEffect(() => {
    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      if (prog >= 100) {
        setProgress(100);
        setLoading(false);
        clearInterval(interval);
      } else {
        setProgress(prog);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Initialize GSAP scroll‑triggered animations once.
  useEffect(() => {
    const pages = document.querySelectorAll('.scroll-page');
    pages.forEach((page, idx) => {
      const title = page.querySelector('.page-title') as HTMLElement;
      const subtitle = page.querySelector('.page-subtitle') as HTMLElement;
      const bg = page.querySelector('.scene-bg') as HTMLElement;

      if (title) {
        gsap.fromTo(title, { opacity: 0, y: 60 }, {
          opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: page, start: 'top 80%', toggleActions: 'play none none reverse' },
        });
      }
      if (subtitle) {
        gsap.fromTo(subtitle, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 0.8, delay: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: page, start: 'top 80%', toggleActions: 'play none none reverse' },
        });
      }

      // Stagger feature cards
      const cards = page.querySelectorAll('.feature-card');
      if (cards.length) {
        gsap.fromTo(cards, { opacity: 0, y: 50, scale: 0.95 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: 'power3.out',
          scrollTrigger: { trigger: page, start: 'top 70%', toggleActions: 'play none none reverse' },
        });
      }

      if (bg) {
        gsap.fromTo(bg, { opacity: 0 }, {
          opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: page, start: 'top 80%', toggleActions: 'play none none reverse' },
        });
      }

      // Add loot only on the third page.
      if (idx > 1) {
        const container = page.querySelector('.scene-bg') as HTMLElement;
        if (container) spawnLoot(container);
      }
    });
  }, []);

  const handleEnterGame = () => {
    gsap.to(wrapperRef.current, {
      opacity: 0,
      scale: 0.95,
      duration: 0.6,
      ease: 'power2.inOut',
      onComplete: () => router.push('/game'),
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const bgEls = document.querySelectorAll<HTMLElement>('.scene-bg');
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const normX = clientX / innerWidth - 0.5;
    const normY = clientY / innerHeight - 0.5;
    bgEls.forEach((bg) => {
      gsap.to(bg, {
        xPercent: normX * -1.5,
        yPercent: normY * -1.5,
        scale: 1 + Math.abs(normY) * 0.03,
        duration: 0.8,
        ease: 'power2.out',
      });
    });
  };

  return (
  <>
    {loading && (
      <div className="loader-overlay">
        <div className="loader-percentage">{progress}%</div>
        <div className="loader-bar">
          <div className="loader-progress" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    )}
    {!loading && (
      <div
        ref={wrapperRef}
        className="landing-wrapper"
        onMouseMove={handleMouseMove}
      >
        {SECTORS.map((sector, i) => (
          <section key={sector.id} className="scroll-page">
            {/* Background image */}
            {sector.bg && (
              <div
                className="scene-bg"
                style={{ backgroundImage: `url(${sector.bg})` }}
              />
            )}
            <div className="scene-overlay" />

            {/* Content */}
            <div className={i === 0 ? 'landing-content' : i === 1 ? 'page-content-wrapper page-center' : 'page-content-wrapper'}>
              {i === 0 ? (
                // -------------------------------------------------------------------
                // First page – hero layout with wallet header and CTA.
                // -------------------------------------------------------------------
                <>
                  <header className="landing-header">
                    <div className="logo-text">QUANTUM QIE</div>
                    {!address ? (
                      <div className="wallet-connect-wrapper">
                        <WalletButton />
                      </div>
                    ) : (
                      <div className="wallet-connected-badge">
                        {address.slice(0, 6)}...{address.slice(-4)} CONNECTED
                      </div>
                    )}
                  </header>
                  <div className="hero-section">
                    <h1 className="hero-title" data-text={sector.title}>
                      <span className="text-gradient">{sector.title.split(' ')[0]}</span>{' '}{sector.title.split(' ').slice(1).join(' ')}
                    </h1>
                    <p className="hero-subtitle">{sector.subtitle}<br />{sector.subtitle2}</p>
                    <div className="cta-container">
                      {!address ? (
                        <div className="cta-hint">Connect your wallet to begin</div>
                      ) : (
                        <button className="btn-enter-game" onClick={handleEnterGame}>
                          ENTER FACTORY HUB
                          <span className="btn-glow" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="scroll-indicator">
                    <span className="scroll-indicator-text">SCROLL TO EXPLORE</span>
                    <div className="scroll-arrow" />
                  </div>
                </>
              ) : i === 1 ? (
                // -------------------------------------------------------------------
                // Page 2 – features showcase with pixel-art visuals
                // -------------------------------------------------------------------
                <>
                  {/* Floating sprites removed to simplify UI and match light theme */}
                  <div className="features-header">
                    <h2 className="page-title">{sector.title}</h2>
                    <p className="page-subtitle">{sector.subtitle}</p>
                  </div>
                  <div className="features-grid">
                    {FEATURES.map((f, fi) => (
                      <div key={fi} className="feature-card">
                        <div className="feature-sprite-wrap">
                          <img src={f.sprite} alt={f.title} className="feature-sprite" />
                        </div>
                        <h3 className="feature-card-title">{f.title}</h3>
                        <p className="feature-card-desc">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // -------------------------------------------------------------------
                // Page 3 – Mining / Deep Mines showcase with art and callouts
                // -------------------------------------------------------------------
                <>
                  <div className="mining-section">
                    <div className="mining-content">
                      <h2 className="page-title">{sector.title}</h2>
                      <p className="page-subtitle">{sector.subtitle}</p>
                      <p className="page-desc">Excavate rich veins beneath the surface. Manage miners, maintain tools, and secure rare ores to craft advanced components and trade on the marketplace.</p>

                      <ul className="mining-list">
                        <li><strong>Resources:</strong> Iron, Copper, Diamonds, Rare Ores</li>
                        <li><strong>Risks:</strong> Cave‑ins, toxic pockets, structural damage</li>
                        <li><strong>Rewards:</strong> High‑tier parts, crafting materials, trade value</li>
                      </ul>

                      <div className="mining-cta">
                        <button className="btn-enter-game" onClick={handleEnterGame}>EXPLORE MINES</button>
                      </div>
                    </div>

                    <div className="mining-art">
                      {sector.bg && <img src={sector.bg} alt="mines" />}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        ))}
        {/* Page 4 — Footer as its own scroll page */}
        <section className="scroll-page footer-page">
          <div className="scene-overlay" />
          <div className="page-content-wrapper page-center">
            <Footer />
          </div>
        </section>
      </div>
    )}
  </>
);

}
