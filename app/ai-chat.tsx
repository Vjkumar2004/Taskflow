import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { aiService, ChatMessage } from '../src/services/aiService';
import { Colors, Shadows } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { MarkdownText } from '../src/components/MarkdownText';

const SUGGESTED_PROMPTS = [
  '⚡ Analyze today\'s schedule and priorities',
  '📋 How can I plan my top priorities for this week?',
  '🎯 Review my active goals and habits progress',
  '⏰ Suggest an optimal deep work daily routine',
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm-1',
    sender: 'ai',
    text: `Hello! I am your **TaskFlow AI Planning Assistant**, powered by Google Gemini.\n\nI can help you:\n- **Plan**: Organize your daily routines and prioritize tasks.\n- **Execute**: Set up time blocks and focus sessions with alarms.\n- **Review**: Track your completion momentum and resolve carryover items.\n\nHow can I help you organize your day?`,
    timestamp: '09:00 AM',
  },
];

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<any>(null);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    const { reply } = await aiService.sendMessage(text, nextHistory);

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, aiMsg]);
    setLoading(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // On Android, account for the system nav bar so the input bar doesn't hide behind it
  const bottomInset = insets.bottom;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.navy} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>TaskFlow AI Assistant</Text>
            <View style={styles.statusRow}>
              <View style={styles.activeDot} />
              <Text style={styles.statusText}>Gemini AI • Live Sync</Text>
            </View>
          </View>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
          </View>
        </View>

        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <View
                key={m.id}
                style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}
              >
                {!isUser && (
                  <View style={styles.botAvatar}>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  </View>
                )}
                <View
                  style={[
                    styles.msgBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    Shadows.sm,
                  ]}
                >
                  <MarkdownText content={m.text} isUser={isUser} />
                  <Text style={[styles.msgTime, isUser && styles.userTime]}>
                    {m.timestamp}
                  </Text>
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={styles.loadingRow}>
              <View style={styles.botAvatar}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.msgBubble, styles.aiBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.typingText}>Analyzing executive records...</Text>
              </View>
            </View>
          )}

          {/* Suggested Prompts when few messages */}
          {messages.length <= 2 && (
            <View style={styles.promptSection}>
              <Text style={styles.promptHeader}>Suggested Executive Prompts</Text>
              <View style={styles.promptChipsWrap}>
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.promptChip}
                    onPress={() => handleSend(prompt)}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar — wrapped in SafeAreaView bottom edges to avoid system nav bar */}
        <SafeAreaView edges={['bottom']} style={[styles.inputBarWrapper, Shadows.md]}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask AI about your tasks, schedule or habits..."
              placeholderTextColor={Colors.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={400}
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || loading}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  aiBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF5EE', justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAi: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.navy,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  msgTime: { fontSize: 10, color: Colors.textMuted, marginTop: 6, textAlign: 'right' },
  userTime: { color: '#94A3B8' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  typingText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  promptSection: { marginTop: 20 },
  promptHeader: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 10 },
  promptChipsWrap: { gap: 8 },
  promptChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promptChipText: { fontSize: 13, color: Colors.navy, fontWeight: '600' },
  inputBarWrapper: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 90,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
