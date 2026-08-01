import React, { useEffect, useRef } from 'react'
import { Bot, User, FileText, ChevronRight, Sparkles } from 'lucide-react'
import { Badge } from '../ui/badge'
import gsap from 'gsap'

export function ChatArea({
  messages,
  isBusy,
  defaultAssistantMessage,
  askMode,
  selectedDocIds,
  listRef
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isBusy, listRef])

  useEffect(() => {
    // GSAP animation for new messages
    if (containerRef.current) {
      const messageElements = containerRef.current.querySelectorAll('.message-bubble')
      if (messageElements.length > 0) {
        const lastMessage = messageElements[messageElements.length - 1]
        gsap.fromTo(lastMessage, 
          { y: 20, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.2)" }
        )
      }
    }
  }, [messages.length])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-12 relative z-10" ref={listRef}>
      <div className="max-w-3xl mx-auto space-y-8 pb-32" ref={containerRef}>
        {messages.map((m) => {
          const isUser = m.role === 'user'
          return (
            <div key={m.id} className={`message-bubble flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
              
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex flex-shrink-0 items-center justify-center mt-1">
                  <Bot className="w-5 h-5 text-accent" />
                </div>
              )}

              <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm backdrop-blur-md ${
                isUser 
                  ? 'bg-foreground text-background rounded-tr-sm' 
                  : 'bg-card border border-border/50 text-foreground rounded-tl-sm'
              }`}>
                {/* Message Content */}
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none break-words leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>

                {/* Citations/Sources */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Sources
                    </p>
                    <div className="space-y-2">
                      {m.sources.map((src, i) => (
                        <div key={i} className="group bg-secondary/30 rounded-lg p-3 text-xs border border-border/40 hover:border-accent/40 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between font-medium text-foreground mb-1">
                            <span className="truncate pr-4">{src.source || 'Unknown'}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0 bg-background/50">
                              Page {src.page_number ?? '?'}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                            {src.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-secondary border border-border/50 flex flex-shrink-0 items-center justify-center mt-1">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          )
        })}

        {isBusy && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex flex-shrink-0 items-center justify-center">
              <Bot className="w-5 h-5 text-accent animate-pulse" />
            </div>
            <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm p-4 backdrop-blur-md shadow-sm">
              <div className="flex gap-1.5 items-center h-6">
                <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {messages.length === 1 && !isBusy && (
          <div className="flex justify-center mt-12 opacity-50">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center border border-border/50 backdrop-blur-md">
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                {defaultAssistantMessage(askMode, selectedDocIds.length)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
