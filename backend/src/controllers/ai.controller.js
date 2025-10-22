import axios from 'axios';

export const aiChat = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const aiReply = response.data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    res.json({ response: aiReply });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get AI response.' });
  }
}; 