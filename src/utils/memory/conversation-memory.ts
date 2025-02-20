export class ConversationMemory {
  constructor(private supabase: any) {}

  async getHistory(userId: string) {
    const { data } = await this.supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    return data || [];
  }

  async saveInteraction(userId: string, message: string, response: string) {
    return await this.supabase
      .from('chat_history')
      .insert([{ user_id: userId, message, response }]);
  }
}