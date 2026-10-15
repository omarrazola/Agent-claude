const stamp = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (msg: string, ...rest: unknown[]) => console.log(`[${stamp()}] ${msg}`, ...rest),
  step: (key: string, msg: string) => console.log(`[${stamp()}] ${key} › ${msg}`),
  warn: (msg: string, ...rest: unknown[]) => console.warn(`[${stamp()}] ⚠ ${msg}`, ...rest),
  error: (msg: string, ...rest: unknown[]) => console.error(`[${stamp()}] ✖ ${msg}`, ...rest),
};
