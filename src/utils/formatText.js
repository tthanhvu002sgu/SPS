/**
 * Automatically converts newline representation strings like '/n', '\n', '\\n' into actual newline characters
 * and handles string formatting for UI display.
 */
export const formatLineBreaks = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/(\\n|\/n)/gi, '\n');
};
