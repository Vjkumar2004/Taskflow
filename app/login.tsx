import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Shadows } from '../src/constants/theme';
import { ShieldCheck, Mail, Lock, ArrowRight, Eye, EyeOff, User, Sparkles } from 'lucide-react-native';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const scrollViewRef = useRef<any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Prevent hardware back button from navigating back to protected screens
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active input focus highlights
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToInput = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  const handleAuthSubmit = async () => {
    if (!email || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    if (authMode === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (authMode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      setLoading(false);

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Email not confirmed. If you just signed up, please confirm your email or disable confirmation in Supabase.');
        } else {
          setErrorMessage(error.message || 'Invalid credentials. Please verify your email and password.');
        }
      } else {
        router.replace('/(tabs)');
      }
    } else {
      // Sign Up Flow
      const { data, error } = await signUp(email.trim(), password, fullName.trim());
      setLoading(false);

      if (error) {
        setErrorMessage(error.message || 'Failed to create account. Please try again.');
      } else if (data?.session) {
        router.replace('/(tabs)');
      } else {
        setSuccessMessage('Account created successfully! You can now sign in.');
        setAuthMode('signin');
      }
    }
  };

  const handleSkipDemo = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.scrollContentTyping,
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          {!keyboardVisible ? (
            <View style={styles.header}>
              <View style={styles.logoBadgeContainer}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoBadgeText}>T</Text>
                </View>
                <View style={styles.logoBadgeGlow} />
              </View>
              <Text style={styles.brandTitle}>TaskFlow</Text>
              <View style={styles.brandTaglinePill}>
                <Sparkles size={13} color={Colors.primary} />
                <Text style={styles.brandSubtitle}>Daily Routine & Task Planner</Text>
              </View>
            </View>
          ) : (
            <View style={styles.headerCompact}>
              <View style={styles.logoBadgeSmall}>
                <Text style={styles.logoBadgeSmallText}>T</Text>
              </View>
              <Text style={styles.brandTitleCompact}>TaskFlow</Text>
            </View>
          )}

          {/* Main Card */}
          <View style={[styles.card, Shadows.lg]}>
            {/* Segmented Mode Switcher */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tabButton, authMode === 'signin' && styles.tabButtonActive]}
                onPress={() => {
                  setAuthMode('signin');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabButtonText, authMode === 'signin' && styles.tabButtonTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, authMode === 'signup' && styles.tabButtonActive]}
                onPress={() => {
                  setAuthMode('signup');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabButtonText, authMode === 'signup' && styles.tabButtonTextActive]}>
                  New Account
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headingSection}>
              <Text style={styles.cardHeading}>
                {authMode === 'signin' ? 'Welcome Back' : 'Get Started'}
              </Text>
              <Text style={styles.cardSubheading}>
                {authMode === 'signin'
                  ? 'Sign in to access your daily checklist & routines'
                  : 'Create your private isolated executive account'}
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Full Name field (Sign Up mode only) */}
            {authMode === 'signup' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name / Title</Text>
                <View style={[styles.inputContainer, focusedField === 'name' && styles.inputFocused]}>
                  <User size={18} color={focusedField === 'name' ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alex Morgan / User"
                    placeholderTextColor={Colors.textLight}
                    value={fullName}
                    onChangeText={setFullName}
                    onFocus={() => {
                      setFocusedField('name');
                      scrollToInput(50);
                    }}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Email Address field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, focusedField === 'email' && styles.inputFocused]}>
                <Mail size={18} color={focusedField === 'email' ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="yourname@gmail.com"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => {
                    setFocusedField('email');
                    scrollToInput(authMode === 'signup' ? 120 : 60);
                  }}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, focusedField === 'password' && styles.inputFocused]}>
                <Lock size={18} color={focusedField === 'password' ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => {
                    setFocusedField('password');
                    scrollToInput(authMode === 'signup' ? 190 : 130);
                  }}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showPassword ? (
                    <EyeOff size={18} color={Colors.textMuted} />
                  ) : (
                    <Eye size={18} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleAuthSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.loginBtnText}>
                    {authMode === 'signin' ? 'Sign In to Workspace' : 'Create My Account'}
                  </Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Demo Quick Mode */}
            <TouchableOpacity style={styles.demoBtn} onPress={handleSkipDemo} activeOpacity={0.7}>
              <Text style={styles.demoBtnText}>Explore in Demo Mode →</Text>
            </TouchableOpacity>
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <ShieldCheck size={16} color={Colors.primary} />
            <Text style={styles.securityText}>Private user isolation enabled with Supabase Auth</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  scrollContentTyping: {
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 220,
  },

  // ── Header Branding ───────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingTop: 4,
  },
  logoBadgeContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoBadgeGlow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: -4,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    opacity: 0.18,
    zIndex: -1,
  },
  logoBadgeText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.navy,
    letterSpacing: 0.5,
  },
  brandTaglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF4EE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },

  logoBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeSmallText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandTitleCompact: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.navy,
  },

  // ── Card ───────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabButtonTextActive: {
    color: Colors.navy,
    fontWeight: '800',
  },

  headingSection: {
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: 0.2,
  },
  cardSubheading: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 18,
  },

  // Quick Accounts Selector
  quickAccountsContainer: {
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAccountsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAccountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAccountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAccountChipActive: {
    backgroundColor: '#FFF4EE',
    borderColor: Colors.primary,
  },
  quickAccountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  quickAccountTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Form Fields
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    height: 50,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.navy,
  },
  eyeBtn: {
    padding: 6,
  },

  // Alert Boxes
  errorBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    lineHeight: 18,
    fontWeight: '500',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  successText: {
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18,
    fontWeight: '600',
  },

  // Action Buttons
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  demoBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  demoBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Security Badge
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
