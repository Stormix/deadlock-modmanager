import { load } from '@tauri-apps/plugin-store';
import usePromise from 'react-promise-suspense';
import { QueryClientProvider } from 'react-query';
import { Outlet } from 'react-router';
import { AlertDialogProvider } from './components/providers/alert-dialog';
import { AppProvider } from './components/providers/app';
import { ThemeProvider } from './components/providers/theme';
import { TooltipProvider } from './components/ui/tooltip';
import { fetchAboutData } from './hooks/use-about';
import { useDeepLink } from './hooks/use-deep-link';
import { useLanguageListener } from './hooks/use-language-listener';
import { Layout } from './layout';
import { getCustomSettings, getMods } from './lib/api';
import { queryClient } from './lib/client';
import { STORE_NAME } from './lib/constants';
import logger from './lib/logger';
import { usePersistedStore } from './lib/store';

const App = () => {
  // Initialize deep link listener
  useDeepLink();
  
  // Initialize language listener
  useLanguageListener();

  const hydrateStore = async () => {
    // Prefetch data
    await queryClient.prefetchQuery('about', fetchAboutData);
    await queryClient.prefetchQuery('mods', getMods);
    await queryClient.prefetchQuery('custom-settings', getCustomSettings);

    // Hydrate store
    await load(STORE_NAME, { autoSave: true, defaults: {} });
    await usePersistedStore.persist.rehydrate();

    logger.debug('Store rehydrated');
  };

  usePromise(hydrateStore, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="deadlock-theme">
        <AppProvider>
          <TooltipProvider>
            <AlertDialogProvider>
              <Layout>
                <Outlet />
              </Layout>
            </AlertDialogProvider>
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
