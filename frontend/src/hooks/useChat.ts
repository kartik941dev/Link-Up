import { useChatContext } from '../context/ChatContext.js';

export const useChat = () => {
  return useChatContext();
};
