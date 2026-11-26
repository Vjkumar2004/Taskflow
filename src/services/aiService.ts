import { supabase } from '../lib/supabase';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const aiService = {
  async sendMessage(
    userText: string,
    history: ChatMessage[]
  ): Promise<{ reply: string; model: string }> {
    try {
      // 1. Fetch live DB context strictly for the logged-in user
      let contextSnippet = '';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let tasks: any[] = [];
        let goals: any[] = [];

        if (user?.id) {
          const [tRes, gRes] = await Promise.all([
            supabase
              .from('custom_tasks')
              .select('title, priority, status, category, due_date, due_time')
              .eq('user_id', user.id)
              .order('due_date', { ascending: true })
              .limit(10),
            supabase
              .from('goals')
              .select('title, category, status, progress_percent')
              .eq('user_id', user.id)
              .limit(5),
          ]);
          tasks = tRes.data || [];
          goals = gRes.data || [];
        }

        const tasksText = tasks
          .map(
            (t: any) =>
              `- [${(t.priority || 'medium').toUpperCase()}] ${t.title} (${t.category || 'General'}, ${t.due_date || 'Today'}) - Status: ${t.status}`
          )
          .join('\n');

        const goalsText = goals
          .map((g: any) => `- ${g.title} (${g.category || 'General'}) - ${g.progress_percent || 0}% completed`)
          .join('\n');

        contextSnippet = `\n[CURRENT USER DATA]\nActive Goals:\n${goalsText || 'None'}\nRecent Tasks:\n${tasksText || 'None'}`;
      } catch {}

      const systemInstruction = `You are TaskFlow AI, an intelligent productivity and planning assistant.
Philosophy: Plan → Execute → Review.
1. Privacy Constraint: You must ONLY answer using the currently authenticated user's own tasks, routines, and goals. NEVER mention, expose, or access other users' data or external business confidential data.
2. Help the user build positive daily habits, maintain focus, and manage their daily routines effectively.
3. Provide concise, structured, and action-oriented answers.
4. If the user asks in Tamil or Tanglish, reply in comfortable, friendly Tamil/Tanglish.
5. Keep suggestions personalized strictly to the user's personal tasks and daily routine.
${contextSnippet}`;

      // Build contents array strictly alternating user and model
      const contents: any[] = [];
      const recentHistory = history.filter((m) => m.id !== 'm-1').slice(-6);

      for (const msg of recentHistory) {
        const role = msg.sender === 'user' ? 'user' : 'model';
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${msg.text}`;
        } else {
          contents.push({
            role,
            parts: [{ text: msg.text }],
          });
        }
      }

      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n${userText}`;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: userText }],
        });
      }

      // Try candidate models
      for (const model of CANDIDATE_MODELS) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800,
              },
            }),
          });

          const data = await res.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
          if (res.ok && candidateText) {
            return {
              reply: candidateText,
              model: `Gemini (${model})`,
            };
          }
        } catch {}
      }

      // Fallback response if API fails or rate limits
      return {
        reply: `Here are tips for your day:\n\n• **Morning Focus**: Tackle your top priority task during your peak energy hours.\n• **Routines**: Check off your daily habits to build consistency.\n• **Review**: Complete or reschedule pending tasks before wrapping up your day.`,
        model: 'TaskFlow Productivity Intelligence',
      };
    } catch (err) {
      return {
        reply: 'I am here to help you plan and execute your daily routines and tasks. What would you like to plan next?',
        model: 'Offline Productivity Mode',
      };
    }
  },
};
