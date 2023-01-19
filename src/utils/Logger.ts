import { MINIMUM_LOG_LEVEL } from 'settings';

export enum LogLevel {
  Debug = 0,
  Info,
  Warning,
  Error
}

export class Logger {
  public static debug(message: string) {
    this.writeLog(LogLevel.Debug, message);
  }

  public static info(message: string) {
    this.writeLog(LogLevel.Info, message);
  }

  public static warning(message: string) {
    this.writeLog(LogLevel.Warning, message);
  }

  public static error(message: string) {
    this.writeLog(LogLevel.Error, message);
  }

  public static roomLink(roomName: string, text?: string) {
    return `<a href="#!/room/${Game.shard.name}/${roomName}">[${text || roomName}]</a>`;
  }

  //#region Private Methods

  private static setColor(text: string, color: string): string {
    return `<font color='${color}'>${text}</font>`;
  }

  private static writeLog(logLevel: LogLevel, message: string) {
    if (logLevel < MINIMUM_LOG_LEVEL) {
      return;
    }

    let levelText: string = '';
    switch (logLevel) {
      case LogLevel.Debug:
        levelText = this.setColor('DEBUG', 'lightblue');
        break;
      case LogLevel.Info:
        levelText = this.setColor(' INFO', 'white');
        break;
      case LogLevel.Warning:
        levelText = this.setColor(' WARN', 'yellow');
        break;
      case LogLevel.Error:
        levelText = this.setColor('ERROR', 'red');
        break;
    }

    const timestamp = this.setColor(Game.time.toString(), 'grey');

    console.log(`${timestamp} ${levelText} ${message}`);
  }

  //#endregion
}
