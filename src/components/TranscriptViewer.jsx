export default function TranscriptViewer({ transcriptJson, transcriptText }) {
  let messages = [];

  if (transcriptJson) {
    try {
      const parsed = typeof transcriptJson === 'string' ? JSON.parse(transcriptJson) : transcriptJson;
      messages = Array.isArray(parsed) ? parsed : [];
    } catch {
      // fallback to plain text
    }
  }

  if (messages.length === 0 && transcriptText) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
        {transcriptText}
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-6">אין תמלול זמין</p>;
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto p-2">
      {messages.map((msg, i) => {
        const isBot = msg.role === 'assistant' || msg.role === 'bot';
        return (
          <div key={i} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isBot ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
              <p className={`text-xs font-medium mb-1 ${isBot ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {isBot ? '🤖 בוט' : '👤 לקוח'}
                {msg.time && <span className="mr-2">{msg.time}</span>}
              </p>
              <p className="text-sm leading-relaxed">{msg.content || msg.message || msg.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}