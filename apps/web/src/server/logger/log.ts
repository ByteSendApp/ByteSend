// lib/logging.ts
import pino from "pino";
import pinoPretty from "pino-pretty";
import { AsyncLocalStorage } from "node:async_hooks";

const isDev = process.env.NODE_ENV !== "production";

type Store = { logger: pino.Logger };
const loggerStore = new AsyncLocalStorage<Store>();

export const rootLogger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: { service: "next-app" },
  },
  isDev
    ? pinoPretty({
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
    })
    : undefined
);

function getCurrentLogger(): pino.Logger {
  return loggerStore.getStore()?.logger ?? rootLogger;
}

export const logger = new Proxy(
  {} as pino.Logger & { setBindings: (bindings: Record<string, any>) => void },
  {
    get(target, prop, receiver) {
      if (prop === "setBindings") {
        return (bindings: Record<string, any>) => {
          const store = loggerStore.getStore();
          if (!store) {
            return;
          }

          const currentLogger = store.logger;
          const newLogger = currentLogger.child(bindings);

          store.logger = newLogger;
        };
      }

      const currentLogger = getCurrentLogger();
      const value = currentLogger[prop as keyof pino.Logger];

      if (typeof value === "function") {
        return value.bind(currentLogger);
      }

      return value;
    },
  }
);

export function withLogger<T>(child: pino.Logger, fn: () => Promise<T> | T) {
  return loggerStore.run({ logger: child }, fn);
}

export function getChildLogger({
  teamId,
  requestId,
  ...rest
}: {
  teamId?: number;
  requestId?: string;
} & Record<string, any>) {
  return logger.child({ teamId, requestId, ...rest });
}
