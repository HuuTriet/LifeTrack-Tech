import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AiAction {
  label: string;
  icon?: string;
  handler: () => void;
}

interface AiChatContextValue {
  open: boolean;
  openChat: (initialMessage?: string, actions?: AiAction[]) => void;
  closeChat: () => void;
  toggleChat: () => void;
  pendingMessage: string | undefined;
  clearPending: () => void;
  contextActions: AiAction[];
}

const AiChatContext = createContext<AiChatContextValue>({
  open: false,
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
  pendingMessage: undefined,
  clearPending: () => {},
  contextActions: [],
});

export const AiChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | undefined>();
  const [contextActions, setContextActions] = useState<AiAction[]>([]);

  const openChat = useCallback((initialMessage?: string, actions?: AiAction[]) => {
    if (initialMessage) setPendingMessage(initialMessage);
    if (actions) setContextActions(actions);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
    setContextActions([]);
  }, []);

  const toggleChat = useCallback(() => setOpen((v) => !v), []);
  const clearPending = useCallback(() => setPendingMessage(undefined), []);

  return (
    <AiChatContext.Provider value={{ open, openChat, closeChat, toggleChat, pendingMessage, clearPending, contextActions }}>
      {children}
    </AiChatContext.Provider>
  );
};

export const useAiChat = () => useContext(AiChatContext);
