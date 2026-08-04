import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';
import gsap from 'gsap';

export function LanguageSelector() {
  const { lang, setLang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // GSAP animation for dropdown
  useEffect(() => {
    if (!menuRef.current) return;
    
    if (isOpen) {
      gsap.fromTo(menuRef.current, 
        { opacity: 0, y: -8, display: 'none' },
        { opacity: 1, y: 0, display: 'block', duration: 0.2, ease: 'power2.out' }
      );
    } else {
      gsap.to(menuRef.current, {
        opacity: 0, y: -8, duration: 0.15, ease: 'power2.in',
        onComplete: () => {
          if (menuRef.current) menuRef.current.style.display = 'none';
        }
      });
    }
  }, [isOpen]);

  const languages = [
    { code: 'en', label: 'English', emoji: '🇺🇸' },
    { code: 'mr', label: 'मराठी', emoji: '🇮🇳' }
  ];

  const currentLang = languages.find(l => l.code === lang) || languages[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/80 transition-colors backdrop-blur-sm text-sm font-medium"
        title={t('lang.label')}
      >
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span>{currentLang.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div 
        ref={menuRef}
        className="absolute right-0 mt-2 w-40 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-lg overflow-hidden z-50"
        style={{ display: 'none' }}
      >
        <div className="p-1">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                lang === l.code 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              <span className="mr-2 text-base">{l.emoji}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {lang === l.code && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
