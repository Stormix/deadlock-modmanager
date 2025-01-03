export const APP_NAME = 'Deadlock Mod Manager';
export const GITHUB_REPO = 'https://github.com/Stormix/deadlock-modmanager';
export const APP_DESCRIPTION =
  'Deadlock Mod Manager is a tool for installing and managing mods for the Valve game "Deadlock".';
export const COPYRIGHT =
  'Not affiliated with Valve. Deadlock, and the Deadlock logo are registered trademarks of Valve Corporation.';

export const STORE_NAME = 'state.json';
export const NOOP = () => {};

export enum SortType {
  DEFAULT = 'default',
  LAST_UPDATED = 'last updated',
  DOWNLOADS = 'download count',
  RATING = 'rating',
  RELEASE_DATE = 'release date'
}
