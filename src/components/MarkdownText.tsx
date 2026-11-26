/**
 * MarkdownText — Zero-dependency markdown renderer for React Native.
 * Handles: **bold**, *italic*, `code`, headings (#/##/###),
 * bullet lists (- / * / •), numbered lists (1.), blockquotes (>), ---
 */
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface MarkdownTextProps {
  content: string;
  isUser?: boolean;
}

// ─── Inline parser: bold / italic / inline-code ──────────────────────────────
function parseInline(text: string, isUser: boolean, key: string): React.ReactNode[] {
  // Pattern: **bold** | *italic* | `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+?)`)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`${key}-t-${lastIndex}`} style={isUser ? is.userText : is.aiText}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    if (match[2] !== undefined) {
      // **bold**
      nodes.push(
        <Text key={`${key}-b-${match.index}`} style={isUser ? is.userBold : is.aiBold}>
          {match[2]}
        </Text>
      );
    } else if (match[3] !== undefined) {
      // *italic*
      nodes.push(
        <Text key={`${key}-i-${match.index}`} style={isUser ? is.userItalic : is.aiItalic}>
          {match[3]}
        </Text>
      );
    } else if (match[4] !== undefined) {
      // `code`
      nodes.push(
        <Text key={`${key}-c-${match.index}`} style={isUser ? is.userCode : is.aiCode}>
          {match[4]}
        </Text>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(
      <Text key={`${key}-tail`} style={isUser ? is.userText : is.aiText}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return nodes.length > 0 ? nodes : [
    <Text key={`${key}-plain`} style={isUser ? is.userText : is.aiText}>{text}</Text>
  ];
}

// ─── Block-level line renderer ────────────────────────────────────────────────
function renderLine(line: string, isUser: boolean, idx: number): React.ReactNode {
  const k = `line-${idx}`;

  // Heading ###
  const h3 = line.match(/^###\s+(.*)/);
  if (h3) return (
    <Text key={k} style={isUser ? is.userH3 : is.aiH3}>
      {h3[1]}
    </Text>
  );

  // Heading ##
  const h2 = line.match(/^##\s+(.*)/);
  if (h2) return (
    <Text key={k} style={isUser ? is.userH2 : is.aiH2}>
      {h2[1]}
    </Text>
  );

  // Heading #
  const h1 = line.match(/^#\s+(.*)/);
  if (h1) return (
    <Text key={k} style={isUser ? is.userH1 : is.aiH1}>
      {h1[1]}
    </Text>
  );

  // Horizontal rule ---
  if (/^---+$/.test(line.trim())) {
    return <View key={k} style={isUser ? is.userHr : is.aiHr} />;
  }

  // Blockquote >
  const bq = line.match(/^>\s?(.*)/);
  if (bq) return (
    <View key={k} style={isUser ? is.userBlockquote : is.aiBlockquote}>
      <Text style={isUser ? is.userText : is.aiText}>{bq[1]}</Text>
    </View>
  );

  // Bullet list: - item | * item | bullet item
  const bullet = line.match(/^[-*\u2022]\s+(.*)/);
  if (bullet) return (
    <View key={k} style={is.listRow}>
      <View style={isUser ? is.userBulletDot : is.aiBulletDot} />
      <Text style={[isUser ? is.userText : is.aiText, { flex: 1 }]}>
        {parseInline(bullet[1], isUser, k)}
      </Text>
    </View>
  );

  // Numbered list: 1. item
  const numbered = line.match(/^(\d+)\.\s+(.*)/);
  if (numbered) return (
    <View key={k} style={is.listRow}>
      <Text style={isUser ? is.userNumLabel : is.aiNumLabel}>{numbered[1]}.</Text>
      <Text style={[isUser ? is.userText : is.aiText, { flex: 1 }]}>
        {parseInline(numbered[2], isUser, k)}
      </Text>
    </View>
  );

  // Empty line spacer
  if (line.trim() === '') return <View key={k} style={{ height: 4 }} />;

  // Normal paragraph
  return (
    <Text key={k} style={[isUser ? is.userText : is.aiText, is.paragraph]}>
      {parseInline(line, isUser, k)}
    </Text>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MarkdownText({ content, isUser = false }: MarkdownTextProps) {
  const lines = content.split('\n');
  return (
    <View style={is.wrapper}>
      {lines.map((line, idx) => renderLine(line, isUser, idx))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const is = StyleSheet.create({
  wrapper: { flexShrink: 1 },

  // AI bubble styles (navy text on white)
  aiText:   { fontSize: 14, color: Colors.navy, lineHeight: 21 },
  aiBold:   { fontSize: 14, color: Colors.navy, fontWeight: '700', lineHeight: 21 },
  aiItalic: { fontSize: 14, color: Colors.navyLight, fontStyle: 'italic', lineHeight: 21 },
  aiCode: {
    fontSize: 12, fontFamily: 'monospace',
    color: Colors.primary, backgroundColor: '#FFF5EE',
    borderRadius: 4, paddingHorizontal: 4, lineHeight: 20,
  },
  aiH1: { fontSize: 18, fontWeight: '800', color: Colors.navy, marginTop: 6, marginBottom: 4, lineHeight: 26 },
  aiH2: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: 5, marginBottom: 3, lineHeight: 24 },
  aiH3: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginTop: 4, marginBottom: 2, lineHeight: 22 },
  aiHr: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  aiBlockquote: {
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    paddingLeft: 10, paddingVertical: 4, marginVertical: 4,
    backgroundColor: '#FFF5EE', borderRadius: 4,
  },
  aiBulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7, marginRight: 8, flexShrink: 0,
  },
  aiNumLabel: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginRight: 6, lineHeight: 21 },

  // User bubble styles (white text on navy)
  userText:   { fontSize: 14, color: '#FFFFFF', lineHeight: 21 },
  userBold:   { fontSize: 14, color: '#FFFFFF', fontWeight: '700', lineHeight: 21 },
  userItalic: { fontSize: 14, color: '#E2E8F0', fontStyle: 'italic', lineHeight: 21 },
  userCode: {
    fontSize: 12, fontFamily: 'monospace',
    color: '#F8FAFC', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4, paddingHorizontal: 4, lineHeight: 20,
  },
  userH1: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 6, marginBottom: 4, lineHeight: 26 },
  userH2: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 5, marginBottom: 3, lineHeight: 24 },
  userH3: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginTop: 4, marginBottom: 2, lineHeight: 22 },
  userHr: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 8 },
  userBlockquote: {
    borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.5)',
    paddingLeft: 10, paddingVertical: 4, marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4,
  },
  userBulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginTop: 7, marginRight: 8, flexShrink: 0,
  },
  userNumLabel: { fontSize: 14, color: '#E2E8F0', fontWeight: '700', marginRight: 6, lineHeight: 21 },

  // Shared
  listRow:   { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
  paragraph: { marginVertical: 2 },
});
