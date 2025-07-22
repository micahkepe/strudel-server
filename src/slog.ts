/**
 * slog - structured logging module
 */

/**
 * The type of a key/value pair to be logged.
 */
export type KVPair = [string, any];

/**
 * Structured Log class that uses log levels and KVPair's to log to the console.
 */
export class SLog {
  /** Debug log level. */
  readonly LevelDebug: number = -4;

  /** Info log level. */
  readonly LevelInfo: number = 0;

  /** Warning log level. */
  readonly LevelWarn: number = 4;

  /** Error log level. */
  readonly LevelError: number = 8;

  /** Current log severity level. Should only be changed by setLevel. */
  private level: number = this.LevelInfo;

  /**
   * Internal function to actually write to the log.
   *
   * @param level string name of level
   * @param msg message to be printed
   * @param pairs structured pairs to be logged
   */
  private log(level: string, msg: string, pairs: Array<KVPair>) {
    console.log(`START ${level}: ${msg}`);
    for (let pair of pairs) {
      console.log(pair[0]);
      console.log(pair[1]);
    }
    console.log(`END ${level}: ${msg}`);
  }

  /**
   * Set the logging severity level to control what messages will appear in the
   * logs.  Messages at or above this severity will be logged.
   *
   * @param level log severity level to use
   */
  setLevel(level: number): void {
    this.level = level;
  }

  /**
   * Log debug message.
   *
   * @param msg log message
   * @param pairs key/value pairs to be logged
   */
  debug(msg: string, ...pairs: Array<KVPair>): void {
    if (this.level <= this.LevelDebug) {
      this.log("DEBUG", msg, pairs);
    }
  }

  /**
   * Log informational message.
   *
   * @param msg log message
   * @param pairs key/value pairs to be logged
   */
  info(msg: string, ...pairs: Array<KVPair>): void {
    if (this.level <= this.LevelInfo) {
      this.log("INFO", msg, pairs);
    }
  }

  /**
   * Log warning message.
   *
   * @param msg log message
   * @param pairs key/value pairs to be logged
   */
  warn(msg: string, ...pairs: Array<KVPair>): void {
    if (this.level <= this.LevelWarn) {
      this.log("WARNING", msg, pairs);
    }
  }

  /**
   * Log error message.
   *
   * @param msg log message
   * @param pairs key/value pairs to be logged
   */
  error(msg: string, ...pairs: Array<KVPair>): void {
    if (this.level <= this.LevelError) {
      this.log("ERROR", msg, pairs);
    }
  }
}

/** Single, constant, globally accessible structured log. */
export const slog: SLog = new SLog();
