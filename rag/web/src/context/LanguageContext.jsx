import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LanguageContext = createContext(null);

const translations = {
  'nav.dashboard': { en: 'Dashboard', mr: 'डॅशबोर्ड' },
  'nav.chat': { en: 'Chat', mr: 'चॅट' },
  'nav.documents': { en: 'Documents', mr: 'दस्तऐवज' },
  'nav.compare': { en: 'Compare', mr: 'तुलना' },
  'nav.history': { en: 'History', mr: 'इतिहास' },
  'nav.settings': { en: 'Settings', mr: 'सेटिंग्ज' },
  'nav.reviewQueue': { en: 'Review Queue', mr: 'पुनरावलोकन रांग' },
  'nav.adminConsole': { en: 'Admin Console', mr: 'प्रशासन कन्सोल' },
  'nav.recentChats': { en: 'Recent Chats', mr: 'अलीकडील चॅट' },
  'nav.newChat': { en: 'New Chat', mr: 'नवीन चॅट' },
  'nav.logout': { en: 'Logout', mr: 'बाहेर पडा' },
  
  'chat.askPlaceholder': { en: 'Ask anything...', mr: 'काहीही विचारा...' },
  'chat.sources': { en: 'Sources', mr: 'स्रोत' },
  'chat.page': { en: 'Page', mr: 'पृष्ठ' },
  'chat.aiDisclaimer': { en: 'AI can make mistakes. Verify important info.', mr: 'AI चुका करू शकते. महत्त्वाची माहिती तपासा.' },
  'chat.stopRecording': { en: 'Stop recording', mr: 'रेकॉर्डिंग थांबवा' },
  'chat.startVoice': { en: 'Start voice input', mr: 'आवाज इनपुट सुरू करा' },
  'chat.stopGenerating': { en: 'Stop generating', mr: 'निर्मिती थांबवा' },
  'chat.sendMessage': { en: 'Send message', mr: 'संदेश पाठवा' },
  'chat.docModeActive': { en: 'Document mode is active. Ask about your selected content.', mr: 'दस्तऐवज मोड सक्रिय आहे. निवडलेल्या सामग्रीबद्दल विचारा.' },
  'chat.uploadFirst': { en: 'Upload or select document(s) first, then ask questions.', mr: 'प्रथम दस्तऐवज अपलोड किंवा निवडा, नंतर प्रश्न विचारा.' },
  'chat.basicModeActive': { en: 'Basic chat mode is active. Ask anything.', mr: 'बेसिक चॅट मोड सक्रिय आहे. काहीही विचारा.' },
  
  'docs.knowledgeBase': { en: 'Knowledge Base', mr: 'ज्ञान भांडार' },
  'docs.availableDocs': { en: 'Available Documents', mr: 'उपलब्ध दस्तऐवज' },
  'docs.searchDocs': { en: 'Search documents...', mr: 'दस्तऐवज शोधा...' },
  'docs.download': { en: 'Download', mr: 'डाउनलोड' },
  'docs.noDocsFound': { en: 'No documents found.', mr: 'दस्तऐवज सापडले नाहीत.' },
  'docs.uploadFiles': { en: 'Upload Files', mr: 'फाईल्स अपलोड करा' },
  'docs.orEnterUrl': { en: 'or enter URL', mr: 'किंवा URL प्रविष्ट करा' },
  
  'lang.english': { en: 'English', mr: 'English' },
  'lang.marathi': { en: 'मराठी', mr: 'मराठी' },
  'lang.label': { en: 'Language', mr: 'भाषा' },

  // Adding extra common keys for auth and settings
  'auth.login.title': { en: 'Welcome Back', mr: 'पुन्हा स्वागत आहे' },
  'auth.login.subtitle': { en: 'Sign in to continue to your AI workspace.', mr: 'तुमच्या AI कार्यक्षेत्रात सुरू ठेवण्यासाठी साइन इन करा.' },
  'auth.login.button': { en: 'Sign in', mr: 'साइन इन करा' },
  'auth.register.title': { en: 'Create your account', mr: 'तुमचे खाते तयार करा' },
  'auth.register.subtitle': { en: 'Start using the AI workspace in seconds.', mr: 'काही सेकंदात AI कार्यक्षेत्र वापरण्यास सुरुवात करा.' },
  'auth.register.button': { en: 'Create account', mr: 'खाते तयार करा' },
  
  'review.title': { en: 'Review Queue', mr: 'पुनरावलोकन रांग' },
  'review.description': { en: 'Approve, reject, and refine document metadata before documents become searchable.', mr: 'दस्तऐवज शोधण्यायोग्य होण्यापूर्वी मेटाडेटा मंजूर करा, नाकारा आणि परिष्कृत करा.' },
  
  'settings.title': { en: 'Settings', mr: 'सेटिंग्ज' },
  'settings.managePrefs': { en: 'Manage your account preferences', mr: 'तुमची खाते प्राधान्ये व्यवस्थापित करा' },
  'settings.profile': { en: 'Profile', mr: 'प्रोफाइल' },
  'settings.session': { en: 'Session', mr: 'सत्र' },
  'settings.signOutDesc': { en: 'Signing out will clear your local session. Your data remains in your account.', mr: 'साइन आउट केल्याने तुमचे स्थानिक सत्र साफ होईल. तुमचा डेटा तुमच्या खात्यात राहील.' },
  'settings.signOut': { en: 'Sign out', mr: 'साइन आउट करा' },
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_lang') || 'en';
  });

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  }, []);

  const t = useCallback((key) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry['en'];
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
