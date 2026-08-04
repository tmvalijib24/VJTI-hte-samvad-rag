import React, { useRef } from 'react'
import { Send, Mic, Square } from 'lucide-react'
import { Button } from '../ui/button'
import { useLanguage } from '../../context/LanguageContext'

export function ChatInput({
  question,
  setQuestion,
  canAsk,
  submitAsk,
  isBusy,
  stopAsk,
  isRecording,
  isTranscribing,
  toggleRecording
}) {
  const { t } = useLanguage()
  const textareaRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canAsk) {
        submitAsk(e)
      }
    }
  }

  const handleInput = (e) => {
    setQuestion(e.target.value)
    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6 bg-gradient-to-t from-background via-background/90 to-transparent z-20 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        <form 
          onSubmit={submitAsk} 
          className="relative bg-card/80 backdrop-blur-xl border border-border/60 shadow-lg rounded-3xl p-2 transition-all focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/40"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={t('chat.askPlaceholder')}
              className="flex-1 max-h-[200px] min-h-[44px] bg-transparent border-0 resize-none py-3 px-4 text-sm focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
              value={question}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              style={{ overflowY: 'auto' }}
            />
            
            <div className="flex shrink-0 items-center gap-2 pr-2 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`rounded-full transition-colors ${
                  isRecording ? 'text-destructive bg-destructive/10 hover:bg-destructive/20 hover:text-destructive' : 'text-muted-foreground hover:text-foreground'
                } ${isTranscribing ? 'animate-pulse' : ''}`}
                onClick={toggleRecording}
                disabled={isBusy && !isRecording}
                title={isRecording ? t('chat.stopRecording') : t('chat.startVoice')}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
              </Button>
              
              {isBusy ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-sm"
                  onClick={stopAsk}
                  title={t('chat.stopGenerating')}
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className={`rounded-full shadow-sm transition-all ${
                    canAsk ? 'bg-accent hover:bg-accent/90 text-white' : 'bg-muted text-muted-foreground opacity-50'
                  }`}
                  disabled={!canAsk}
                  title={t('chat.sendMessage')}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
        <div className="text-center mt-3 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
          {t('chat.aiDisclaimer')}
        </div>
      </div>
    </div>
  )
}
