import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  Shield,
  Zap,
  Check,
  ArrowRight,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  KeyRound,
  Sparkles,
  Search
} from 'lucide-react';
// Make sure to import your logo correctly based on your project structure
import logo from '../assets/logo.png'; 
import type { StoredSession } from '../components/main/types';

type IconProp = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type AuthMode = 'landing' | 'login' | 'register' | 'forgot' | 'mfa' | 'signupVerify' | 'reset';
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// --- ANIMATION VARIANTS ---

const pageVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.98,
    transition: { duration: 0.3, ease: "easeIn" }
  }
};

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  })
};

const floatingShape: Variants = {
  animate: {
    y: [0, -20, 0],
    rotate: [0, 5, -5, 0],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
  },
};

// --- SUB-COMPONENTS ---

type InputFieldProps = {
  icon: IconProp;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPassword?: boolean;
  showPassword?: boolean;
  togglePassword?: () => void;
  required?: boolean;
  disabled?: boolean;
};

const InputField: React.FC<InputFieldProps> = ({ icon: Icon, type = 'text', placeholder = '', value, onChange, isPassword = false, showPassword = false, togglePassword, required = true, disabled = false }) => (
  <div className="relative mb-5 group">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <Icon className={`w-5 h-5 transition-colors duration-300 ${disabled ? 'text-slate-300' : 'text-slate-500 group-focus-within:text-slate-900'}`} />
    </div>
    <input
      type={type}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full pl-12 pr-4 py-4 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:border-slate-900 transition-all duration-300 shadow-sm font-medium ${
        disabled
          ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-slate-50 border border-slate-200 focus:ring-slate-900/10 focus:bg-white'
      }`}
    />
    {isPassword && !disabled && (
      <button 
        type="button" 
        onClick={togglePassword}
        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    )}
  </div>
);

type AuthProps = { onAuthSuccess?: (session?: StoredSession) => void; onBack?: () => void };

// --- MAIN COMPONENT ---

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onBack }) => {
  const [mode, setMode] = useState<AuthMode>(() => {
    const savedMode = localStorage.getItem('authMode');
    return (savedMode as AuthMode) || 'landing';
  });
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({ email: '', username: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const [captchaSessionId, setCaptchaSessionId] = useState<string | null>(null);
  const [captchaProblem, setCaptchaProblem] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaErrorMessage, setCaptchaErrorMessage] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [preVerifyUserId, setPreVerifyUserId] = useState<number | null>(null);
  const [pendingSignupEmail, setPendingSignupEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: 'bg-gray-200' };
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    
    if (strength === 0) return { level: 1, label: 'Weak', color: 'bg-red-400' };
    if (strength <= 2) return { level: 2, label: 'Fair', color: 'bg-amber-400' };
    if (strength <= 3) return { level: 3, label: 'Good', color: 'bg-slate-500' };
    return { level: 4, label: 'Strong', color: 'bg-emerald-400' };
  };
  const passwordStrength = getPasswordStrength(formData.password);

  useEffect(() => {
    if (!isAccountLocked || lockoutTimeRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsAccountLocked(false);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAccountLocked, lockoutTimeRemaining]);

  useEffect(() => {
    localStorage.setItem('authMode', mode);
  }, [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const tokenParam = params.get('token');
    if (modeParam === 'reset' && tokenParam) {
      setResetToken(tokenParam);
      setMode('reset');
      setSuccessMessage('Reset link verified. Set your new password.');
      setErrorMessage(null);
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validatePasswordPolicy = (password: string): string | null => {
    if (password.length < 10) return 'Password must be at least 10 characters long.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
    return null;
  };

  const generateCaptcha = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/captcha/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setCaptchaSessionId(data.session_id);
        setCaptchaProblem(data.captcha || data.problem);
        setCaptchaAnswer('');
        setCaptchaErrorMessage(null);
        setErrorMessage(null);
      } else {
        setErrorMessage('Failed to generate CAPTCHA. Try again.');
      }
    } catch {
      setErrorMessage('Connection error. Is your server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'login' && !captchaProblem && !isAccountLocked) {
      generateCaptcha();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isAccountLocked]);

  const handleModeChange = (newMode: AuthMode) => {
    const order = { landing: 0, login: 1, register: 2, signupVerify: 3, forgot: 4, reset: 5, mfa: 6 };
    setDirection(order[newMode] > order[mode] ? 1 : -1);
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormData({ email: '', username: '', password: '', confirmPassword: '' });
    setVerificationCode('');
    setCaptchaSessionId(null);
    setCaptchaProblem(null);
    setCaptchaAnswer('');
    setCaptchaErrorMessage(null);
    setFailedAttempts(0);
    setIsAccountLocked(false);
    setLockoutTimeRemaining(0);
    setPendingSignupEmail('');
    setResetToken('');
  };

  const handleLoginSubmit = async () => {
    try {
      setLoading(true);
      const isAdminLogin = formData.email.trim().toLowerCase() === 'admin@factguard.com';
      const response = await fetch(`${API_BASE}${isAdminLogin ? '/api/admin/login' : '/api/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok) {
        if (isAdminLogin) {
          const session = {
            token: data.access_token || data.token || null,
            access_token: data.access_token || data.token || null,
            expires_at: data.expires_at || null,
            user: data.email || formData.email,
            user_id: 'admin',
            username: data.username || 'FactGuard Admin',
            email: data.email || formData.email,
            role: 'admin' as const,
          };
          localStorage.setItem('fg_session', JSON.stringify(session));
          setFailedAttempts(0);
          onAuthSuccess?.(session);
          return;
        }

        if (data.status === 'mfa_required') {
          setPreVerifyUserId(data.user_id || null);
          setMode('mfa');
          setSuccessMessage(data.dev_code ? `MFA code generated. Dev code: ${data.dev_code}` : 'MFA code generated. Check your email.');
          return;
        }

        const session = {
          token: data.access_token || data.token || null,
          access_token: data.access_token || data.token || null,
          expires_at: data.expires_at || null,
          user: data.user || data.email || formData.email,
          user_id: data.user_id || null,
          username: data.username || null,
          email: data.email || formData.email,
        };
        localStorage.setItem('fg_session', JSON.stringify(session));
        setFailedAttempts(0);
        onAuthSuccess?.(session);
      } else {
        if (response.status === 401) {
          const remaining = data.remaining_attempts ?? 5;
          const lockoutTime = data.lockout_time ?? 0;
          const isLocked = data.is_locked ?? false;

          if (isLocked && lockoutTime > 0) {
            setIsAccountLocked(true);
            setLockoutTimeRemaining(lockoutTime);
            setErrorMessage(`Account locked for security. Try again in ${formatTime(lockoutTime)}`);
          } else {
            const attempts = 5 - (remaining ?? 0);
            setFailedAttempts(attempts);
            setErrorMessage(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          }
          setCaptchaErrorMessage(null);
        } else {
          const errorDetail = Array.isArray(data.detail) ? data.detail[0].msg : data.detail;
          setErrorMessage(errorDetail || 'Login failed. Please try again.');
        }
        setCaptchaAnswer('');
        generateCaptcha();
      }
    } catch {
      setErrorMessage('Connection error. Is your server running?');
    } finally {
      setLoading(false);
    }
  };

  const verifyCaptcha = async () => {
    if (!captchaAnswer.trim()) {
      setCaptchaErrorMessage('Please enter the CAPTCHA answer.');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ session_id: captchaSessionId, answer: parseInt(captchaAnswer, 10) }),
      });
      if (response.ok) {
        setCaptchaErrorMessage(null);
        setErrorMessage(null);
        await handleLoginSubmit();
      } else {
        setCaptchaErrorMessage('Incorrect CAPTCHA. Please try again.');
        setCaptchaAnswer('');
        generateCaptcha();
      }
    } catch {
      setCaptchaErrorMessage('CAPTCHA verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isAccountLocked && lockoutTimeRemaining > 0) {
      setErrorMessage(`Account locked for security. Try again in ${formatTime(lockoutTimeRemaining)}`);
      return;
    }

    if (mode === 'login') {
      await verifyCaptcha();
      return;
    }

    if (mode === 'register' || mode === 'reset') {
      const policyError = validatePasswordPolicy(formData.password);
      if (policyError) {
        setErrorMessage(policyError);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    let endpoint = '/api/login';
    if (mode === 'register') endpoint = '/api/signup';
    if (mode === 'forgot') endpoint = '/api/forgot-password';
    if (mode === 'reset') endpoint = '/api/reset-password/confirm';

    const bodyPayload =
      mode === 'register'
        ? { email: formData.email, username: formData.username, password: formData.password }
        : mode === 'forgot'
          ? { email: formData.email }
          : mode === 'reset'
            ? { token: resetToken, new_password: formData.password }
            : formData;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok) {
        if (mode === 'register') {
          if (data.status === 'pending_verification') {
            setPendingSignupEmail(data.email || formData.email);
            setMode('signupVerify');
            setSuccessMessage(data.dev_code ? `Activation code generated. Dev code: ${data.dev_code}` : (data.message || 'Activation code sent. Check your email.'));
          } else {
            setSuccessMessage('Registration request submitted.');
          }
        } else if (mode === 'forgot') {
          setSuccessMessage(data.message || 'Reset instructions have been sent.');
        } else if (mode === 'reset') {
          setSuccessMessage(data.message || 'Password updated. Please sign in.');
          window.history.replaceState({}, '', window.location.pathname);
          setMode('login');
          setFormData({ email: '', username: '', password: '', confirmPassword: '' });
          setResetToken('');
        }
      } else {
        const errorDetail = Array.isArray(data.detail) ? data.detail[0].msg : (data.detail || data.message);
        setErrorMessage(errorDetail || "Request failed. Please try again.");
      }
    } catch {
      setErrorMessage("Connection error. Is your server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans selection:bg-slate-200 overflow-hidden relative flex items-center justify-center p-4">
      
      {/* PAGE BACKGROUND LAYER (Applies to both Landing and Auth) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div variants={floatingShape} animate="animate" className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-slate-300/30 rounded-full mix-blend-multiply filter blur-[100px]" />
        <motion.div variants={floatingShape} animate="animate" transition={{ delay: 2 }} className="absolute top-[10%] -right-[10%] w-[50vw] h-[50vw] bg-slate-300/30 rounded-full mix-blend-multiply filter blur-[100px]" />
        
        {/* Subtle Grid Pattern for tech feel */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* ============================== */}
        {/* LANDING VIEW           */}
        {/* ============================== */}
        {mode === 'landing' && (
          <motion.div key="landing" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="relative w-full max-w-6xl flex flex-col items-center z-10 py-12">
            
            {/* Header Area */}
            <div className="mb-16 text-center">
              <div className="flex items-center justify-center gap-5 mb-8">
                <motion.div 
                  whileHover={{ scale: 1.05, rotate: 5 }} 
                  className="inline-flex relative overflow-hidden group bg-white/80 backdrop-blur-xl p-4 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white"
                >
                  {/* Fallback to Shield if logo image fails, otherwise render image */}
                  {logo ? (
                     <img src={logo} alt="FactGuard" className="w-14 h-14 relative z-10 object-contain" />
                  ) : (
                     <Shield className="w-14 h-14 text-slate-700 relative z-10" />
                  )}
                </motion.div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 drop-shadow-sm">
                  Fact<span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">Guard</span>
                </h1>
              </div>
              <p className="text-xl md:text-2xl text-slate-500 max-w-3xl mx-auto font-medium leading-relaxed">
                Defending truth in the age of synthetic media. <br className="hidden md:block"/> Upload, verify, and expose deepfakes instantly.
              </p>
            </div> 

            {/* Upgraded Feature Cards */}
            <div className="grid md:grid-cols-3 gap-8 w-full mb-16 px-4 relative">
              {/* Background glowing orb behind cards */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-2xl bg-slate-400/10 blur-[100px] -z-10 rounded-full pointer-events-none" />

              {[
                { icon: Search, title: 'Deepfake Detection', desc: 'Advanced AI analysis to uncover subtle synthetic artifacts and anomalies.' },
                { icon: Zap, title: 'Real-time Verify', desc: 'Instant confidence scores and visual feedback on uploaded media.' },
                { icon: Check, title: 'Forensic Reports', desc: 'Downloadable, detailed forensic evidence for flagged content.' }
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ y: -10 }} 
                  className="relative group bg-white/60 backdrop-blur-2xl border border-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 text-left overflow-hidden transition-all duration-300"
                >
                  {/* Subtle inner gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl flex items-center justify-center mb-6 text-slate-700 shadow-md border border-white">
                      <item.icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center w-full px-4">
              <button 
                onClick={() => handleModeChange('login')} 
                className="group relative px-10 py-5 bg-[#0F172A] text-white font-bold rounded-2xl shadow-2xl hover:shadow-slate-900/30 transition-all duration-300 active:scale-95 overflow-hidden flex-1 sm:flex-none max-w-xs"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center justify-center gap-3 text-lg">
                  Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <button 
                onClick={onBack || (() => console.log('Scroll down or handle Learn More'))} 
                className="group relative px-10 py-5 bg-white/50 backdrop-blur-md text-slate-900 font-bold rounded-2xl shadow-xl hover:bg-white hover:shadow-2xl transition-all duration-300 active:scale-95 border border-white/80 flex-1 sm:flex-none max-w-xs"
              >
                <span className="relative flex items-center justify-center gap-3 text-lg">
                  Learn More
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================== */}
        {/* SPLIT-PANE AUTH CARD       */}
        {/* ============================== */}
        {mode !== 'landing' && (
          <motion.div key="auth-container" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-5xl z-20">
            
            <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[650px]">
              
              {/* LEFT SIDE: IMAGE & BRANDING (Hidden on small screens) */}
              <div className="hidden md:flex md:w-5/12 relative bg-slate-900 overflow-hidden">
                {/* Unsplash Image */}
                <img 
                  src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1000&auto=format&fit=crop" 
                  alt="AI Security Abstract" 
                  className="absolute inset-0 object-cover w-full h-full opacity-40 mix-blend-overlay"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90" />
                
                {/* Decorative Shapes inside the left panel */}
                <div className="absolute top-[-10%] left-[-20%] w-64 h-64 bg-slate-500/30 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] right-[-20%] w-64 h-64 bg-slate-500/30 rounded-full blur-3xl" />
                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] opacity-10 pointer-events-none" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="0.5" strokeDasharray="2 2"/>
                  <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="0.5" strokeDasharray="2 2"/>
                </svg>

                {/* Left Panel Content */}
                <div className="relative z-10 p-12 flex flex-col justify-between h-full text-white w-full">
                  <div>
                    <button onClick={() => handleModeChange('landing')} className="flex items-center gap-2 text-slate-200 hover:text-white transition-colors text-sm font-bold bg-white/10 px-4 py-2 rounded-full w-fit backdrop-blur-md border border-white/10 hover:bg-white/20">
                      <ArrowRight className="w-4 h-4 rotate-180" /> Home
                    </button>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                        <Shield className="w-8 h-8 text-slate-300" />
                      </div>
                      <span className="text-3xl font-black tracking-tight drop-shadow-md">FactGuard</span>
                    </div>
                    <h2 className="text-4xl font-bold mb-4 leading-tight">Verify the <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-100 drop-shadow-lg">Absolute Truth.</span></h2>
                    <p className="text-slate-200/90 text-lg leading-relaxed font-medium">
                      Join our secure forensic platform. Detect synthetic media, deepfakes, and misinformation instantly.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-slate-200 text-sm font-bold">
                    <Sparkles className="w-4 h-4" /> Powered by AI Forensics
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: FORMS */}
              <div className="w-full md:w-7/12 p-8 md:p-14 relative flex flex-col justify-center">
                
                {/* Subtle Right Side Background Graphic */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />

                {/* Mobile Back Button (Only visible when image panel is hidden) */}
                <button onClick={() => handleModeChange('landing')} className="md:hidden absolute top-6 left-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div 
                    key={mode} 
                    custom={direction} 
                    variants={slideVariants} 
                    initial="enter" 
                    animate="center" 
                    exit="exit"
                    className="w-full max-w-md mx-auto"
                  >
                    {/* Form Header */}
                    <div className="mb-10 text-center md:text-left">
                      <div className="md:hidden inline-block p-4 bg-slate-50 rounded-2xl mb-4 text-slate-700">
                        {mode === 'login' && <Lock className="w-8 h-8" />}
                        {mode === 'register' && <User className="w-8 h-8" />}
                        {mode === 'forgot' && <KeyRound className="w-8 h-8" />}
                        {mode === 'mfa' && <KeyRound className="w-8 h-8" />}
                        {mode === 'signupVerify' && <KeyRound className="w-8 h-8" />}
                        {mode === 'reset' && <KeyRound className="w-8 h-8" />}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 drop-shadow-sm">
                        {mode === 'login' && 'Welcome Back'}
                        {mode === 'register' && 'Create Account'}
                        {mode === 'forgot' && 'Reset Password'}
                        {mode === 'mfa' && 'MFA Verification'}
                        {mode === 'signupVerify' && 'Verify Account'}
                        {mode === 'reset' && 'Set New Password'}
                      </h2>
                      <p className="text-slate-500 font-medium text-lg">
                        {mode === 'login' && 'Enter your credentials to access the dashboard.'}
                        {mode === 'register' && 'Join the network to start verifying media.'}
                        {mode === 'forgot' && 'Enter your email to receive reset instructions.'}
                        {mode === 'mfa' && 'Enter the 6-digit OTP code to complete sign in.'}
                        {mode === 'signupVerify' && 'Enter the activation code sent to your email.'}
                        {mode === 'reset' && 'Create a new password for your account.'}
                      </p>
                    </div>

                    {successMessage && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-2xl flex items-center gap-3 shadow-sm bg-emerald-50 border border-emerald-100 text-emerald-600">
                        <Check className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-bold">{successMessage}</p>
                      </motion.div>
                    )}

                    {/* ERROR ALERT */}
                    {errorMessage && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-shake shadow-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-bold">{errorMessage}</p>
                      </div>
                    )}

                    {isAccountLocked && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-amber-900">Account Temporarily Locked</span>
                          <span className="text-lg font-black text-amber-600">{formatTime(lockoutTimeRemaining)}</span>
                        </div>
                        <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" initial={{ width: '100%' }} animate={{ width: `${(lockoutTimeRemaining / 900) * 100}%` }} transition={{ duration: 1, ease: 'linear' }} />
                        </div>
                        <p className="text-xs text-amber-700 mt-2 font-semibold">Too many failed attempts. Please wait before trying again.</p>
                      </motion.div>
                    )}

                    {failedAttempts > 0 && !isAccountLocked && mode === 'login' && (
                      <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
                        <p className="text-xs font-bold text-red-700">
                          Incorrect password. {Math.max(0, 5 - failedAttempts)} attempt{Math.max(0, 5 - failedAttempts) === 1 ? '' : 's'} left.
                        </p>
                      </div>
                    )}

                    {mode !== 'mfa' && mode !== 'signupVerify' && <form onSubmit={handleSubmit}>
                      
                      {mode === 'register' && (
                        <InputField icon={User} placeholder="Username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} disabled={isAccountLocked} />
                      )}
                       
                      {mode !== 'reset' && (
                        <InputField icon={Mail} type="email" placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={isAccountLocked} />
                      )}
                       
                      {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                        <InputField icon={Lock} type={showPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} isPassword={true} showPassword={showPassword} togglePassword={() => setShowPassword(!showPassword)} disabled={isAccountLocked} />
                      )}

                      {mode === 'login' && (
                        <div className="flex justify-end mb-6">
                          <button type="button" onClick={() => handleModeChange('forgot')} disabled={isAccountLocked} className="text-sm font-bold text-slate-700 hover:text-slate-900 disabled:text-slate-300 transition-colors">
                            Forgot password?
                          </button>
                        </div>
                      )}
                      
                      {(mode === 'register' || mode === 'reset') && (
                        <>
                          {formData.password && (
                            <div className="mb-5 px-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Strength</span>
                                <span className={`text-xs font-black uppercase tracking-wider ${passwordStrength.color.replace('bg-', 'text-')}`}>{passwordStrength.label}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${passwordStrength.color}`} style={{ width: `${(passwordStrength.level / 4) * 100}%` }} />
                              </div>
                            </div>
                          )}
                          <InputField icon={Lock} type={showConfirmPassword ? "text" : "password"} placeholder={mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'} value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} isPassword={true} showPassword={showConfirmPassword} togglePassword={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isAccountLocked} />
                          {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                            <p className="text-xs text-red-500 font-bold mb-4 px-2">Passwords do not match</p>
                          )}
                        </>
                      )}

                      {mode === 'login' && (
                        <AnimatePresence>
                          {captchaProblem && !isAccountLocked && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-slate-700" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase">Security Verification</h3>
                              </div>
                              <div className="text-sm text-slate-800 mb-3 font-semibold flex justify-between items-center">
                                <span>Solve this: <span className="text-lg font-black tracking-widest ml-1">{captchaProblem}</span></span>
                                <button type="button" onClick={generateCaptcha} className="text-[10px] bg-white px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors">Refresh</button>
                              </div>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Type the answer here"
                                value={captchaAnswer}
                                onChange={(e) => {
                                  setCaptchaAnswer(e.target.value.replace(/[^0-9]/g, ''));
                                  if (captchaErrorMessage) setCaptchaErrorMessage(null);
                                }}
                                disabled={loading}
                                className="w-full px-4 py-3 border-2 border-white rounded-xl text-center text-lg font-black focus:outline-none focus:border-slate-900 shadow-sm transition-all"
                              />
                              {captchaErrorMessage && (
                                <p className="mt-2 text-xs font-bold text-red-600">{captchaErrorMessage}</p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}

                      <button disabled={loading || isAccountLocked || (mode === 'login' && !captchaAnswer.trim())} className={`w-full bg-slate-900 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 mt-2 group ${loading || isAccountLocked || (mode === 'login' && !captchaAnswer.trim()) ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <>
                            {mode === 'login' && 'Sign In'}
                            {mode === 'register' && 'Sign Up'}
                            {mode === 'forgot' && 'Send Reset Link'}
                            {mode === 'reset' && 'Update Password'}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </form>}

                    {mode === 'signupVerify' && (
                      <div className="space-y-4">
                        <InputField
                          icon={Lock}
                          type="text"
                          placeholder="Activation OTP (6 digits)"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                          required={false}
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setErrorMessage(null);
                              setSuccessMessage(null);
                              if (!pendingSignupEmail) {
                                setErrorMessage('Missing email for activation.');
                                return;
                              }
                              if (!verificationCode || verificationCode.length !== 6) {
                                setErrorMessage('Please enter the 6-digit activation code.');
                                return;
                              }
                              try {
                                setLoading(true);
                                const res = await fetch(`${API_BASE}/api/signup/verify`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: pendingSignupEmail, code: verificationCode }),
                                });
                                const dtext = await res.text();
                                const d = dtext ? JSON.parse(dtext) : {};
                                if (res.ok) {
                                  setSuccessMessage('Account activated. Please sign in.');
                                  setMode('login');
                                  setVerificationCode('');
                                  setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                                } else {
                                  setErrorMessage(d.detail || d.message || 'Activation failed');
                                }
                              } catch {
                                setErrorMessage('Activation failed. Connection error.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
                          >
                            Activate
                          </button>
                          <button type="button" onClick={() => handleModeChange('register')} className="px-6 py-3 bg-slate-100 rounded-2xl font-bold">
                            Back
                          </button>
                        </div>
                      </div>
                    )}

                    {mode === 'mfa' && (
                      <div className="space-y-4">
                        <InputField
                          icon={Lock}
                          type="text"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                          required={false}
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              setErrorMessage(null);
                              setSuccessMessage(null);
                              if (!preVerifyUserId) {
                                setErrorMessage('No user to verify.');
                                return;
                              }
                              if (!verificationCode || verificationCode.length !== 6) {
                                setErrorMessage('Please enter the 6-digit verification code.');
                                return;
                              }
                              try {
                                setLoading(true);
                                const res = await fetch(`${API_BASE}/api/mfa/login`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ user_id: preVerifyUserId, code: verificationCode }),
                                });
                                const dtext = await res.text();
                                const d = dtext ? JSON.parse(dtext) : {};
                                if (res.ok) {
                                  const session = {
                                    token: d.access_token || d.token || null,
                                    access_token: d.access_token || d.token || null,
                                    expires_at: d.expires_at || null,
                                    user: d.email || formData.email,
                                    user_id: d.user_id || preVerifyUserId,
                                    username: d.username || null,
                                    email: d.email || formData.email,
                                  };
                                  localStorage.setItem('fg_session', JSON.stringify(session));
                                  setSuccessMessage('Login complete. Redirecting...');
                                  onAuthSuccess?.(session);
                                } else {
                                  setErrorMessage(d.detail || d.message || 'Verification failed');
                                }
                              } catch {
                                setErrorMessage('Verification failed. Connection error.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
                          >
                            Verify
                          </button>
                          <button type="button" onClick={() => handleModeChange('login')} className="px-6 py-3 bg-slate-100 rounded-2xl font-bold">
                            Back
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Form Footer Links */}
                    {mode !== 'mfa' && mode !== 'signupVerify' && <div className="mt-8 text-center md:text-left">
                      <p className="text-slate-500 font-medium">
                        {mode === 'login' && (
                          <>Don't have an account? <button type="button" onClick={() => handleModeChange('register')} className="ml-2 text-slate-700 font-black hover:underline">Create one</button></>
                        )}
                        {mode === 'register' && (
                          <>Already have an account? <button type="button" onClick={() => handleModeChange('login')} className="ml-2 text-slate-700 font-black hover:underline">Sign in</button></>
                        )}
                        {mode === 'forgot' && (
                          <>Remember your password? <button type="button" onClick={() => handleModeChange('login')} className="ml-2 text-slate-700 font-black hover:underline">Back to Login</button></>
                        )}
                        {mode === 'reset' && (
                          <>Remember your password? <button type="button" onClick={() => handleModeChange('login')} className="ml-2 text-slate-700 font-black hover:underline">Back to Login</button></>
                        )}
                      </p>
                    </div>}

                  </motion.div>
                </AnimatePresence>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;

