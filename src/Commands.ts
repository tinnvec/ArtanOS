import { Logger } from 'utils/Logger';

global.clearMemory = function() {
  for (const key in Memory) {
    delete Memory[key as keyof typeof Memory]
  }

  Logger.info('Memory erased');
}

global.showMemory = function() {
  Logger.info(JSON.stringify(Memory));
}
