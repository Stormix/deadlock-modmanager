import { toast } from 'sonner';
import InstallWithCollection from '@/components/install-with-collection';
import { DataTable } from '@/components/ui/data-table';
import useUninstall from '@/hooks/use-uninstall';
import { createLogger } from '@/lib/logger';
import { usePersistedStore } from '@/lib/store';
import { type LocalMod, ModStatus } from '@/types/mods';
import { createColumns } from './columns';

const logger = createLogger('installation');

export const ModsTable = ({ mods }: { mods: LocalMod[] }) => {
  const { setModStatus, setInstalledVpks } = usePersistedStore();
  const { uninstall } = useUninstall();

  return (
    <InstallWithCollection>
      {({ install }) => {
        const columns = createColumns(
          install,
          {
            onStart: (mod) => {
              logger.info('Starting installation', { mod: mod.remoteId });
              setModStatus(mod.remoteId, ModStatus.INSTALLING);
            },
            onComplete: (mod, result) => {
              logger.info('Installation complete', {
                mod: mod.remoteId,
                result: result.installed_vpks,
                hasFileTree: !!result.file_tree,
              });
              setModStatus(mod.remoteId, ModStatus.INSTALLED);
              setInstalledVpks(
                mod.remoteId,
                result.installed_vpks,
                result.file_tree
              );
            },
            onError: (mod, error) => {
              logger.error('Installation error', { mod: mod.remoteId, error });

              switch (error.kind) {
                case 'modAlreadyInstalled':
                  setModStatus(mod.remoteId, ModStatus.INSTALLED);
                  toast.error(error.message);
                  break;
                default:
                  setModStatus(mod.remoteId, mod.status);
                  toast.error(error.message);
              }
            },
            onCancel: (mod) => {
              logger.info('Installation canceled', { mod: mod.remoteId });
              setModStatus(mod.remoteId, ModStatus.DOWNLOADED);
            },
            onFileTreeAnalyzed: (mod, fileTree) => {
              logger.info('File tree analyzed', {
                mod: mod.remoteId,
                hasMultipleFiles: fileTree.has_multiple_files,
                totalFiles: fileTree.total_files,
              });
              if (fileTree.has_multiple_files) {
                toast.info(
                  `${mod.name} contains ${fileTree.total_files} files. Select which ones to install.`
                );
              }
            },
          },
          (mod) => uninstall(mod, true), // Remove
          (mod) => uninstall(mod, false) // Uninstall
        );

        return <DataTable columns={columns} data={mods} />;
      }}
    </InstallWithCollection>
  );
};
