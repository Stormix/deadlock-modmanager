import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useConfirm } from '@/components/providers/alert-dialog';
import logger from '@/lib/logger';
import { usePersistedStore } from '@/lib/store';
import { type LocalMod, ModStatus } from '@/types/mods';

const useUninstall = () => {
  const confirm = useConfirm();
  const { removeMod, setModStatus } = usePersistedStore();

  const uninstall = async (mod: LocalMod, remove: boolean) => {
    try {
      let shouldUninstall = true;
      
      // Show confirmation dialog for remove action regardless of mod status
      if (remove) {
        shouldUninstall = !!(await confirm({
          title: 'Are you sure you want to remove this mod? This will delete the mod from your mods list and remove all files.',
          body: 'This action cannot be undone.',
          actionButton: 'Remove',
          cancelButton: 'Cancel',
        }));
      }
      
      if (!shouldUninstall) {
        return;
      }

      if (mod.status === ModStatus.INSTALLED) {
        logger.info('Uninstalling mod', {
          modId: mod.remoteId,
          vpks: mod.installedVpks,
        });
        if (remove) {
          await invoke('purge_mod', {
            modId: mod.remoteId,
            vpks: mod.installedVpks ?? [],
          });
        } else {
          await invoke('uninstall_mod', {
            modId: mod.remoteId,
            vpks: mod.installedVpks ?? [],
          });
        }
        setModStatus(mod.remoteId, ModStatus.DOWNLOADED);
      }

      if (remove) {
        // Always purge the mod from AppData when removing, regardless of installation status
        if (mod.status !== ModStatus.INSTALLED) {
          await invoke('purge_mod', {
            modId: mod.remoteId,
            vpks: mod.installedVpks ?? [],
          });
        }
        await removeMod(mod.remoteId);
      }
      toast.success('Mod uninstalled successfully');
    } catch (error) {
      logger.error(error);
      toast.error('Failed to uninstall mod');
    }
  };

  return { uninstall };
};

export default useUninstall;
