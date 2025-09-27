import type { ModDto } from "@deadlock-mods/shared";
import { useHover } from "@uidotdev/usehooks";
import { Check, DownloadIcon, Loader2, PlusIcon, X, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GrInstallOption } from "react-icons/gr";
import { RiErrorWarningLine } from "react-icons/ri";
import { toast } from "sonner";
import { FileSelectorDialog } from "@/components/downloads/file-selector-dialog";
import { MultiFileDownloadDialog } from "@/components/downloads/multi-file-download-dialog";
import ErrorBoundary from "@/components/shared/error-boundary";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnalyticsContext } from "@/contexts/analytics-context";
import { useDownload } from "@/hooks/use-download";
import useActivationWithCollection from "@/hooks/use-install-with-collection";
import { useModDownloads } from "@/hooks/use-mod-downloads";
import useUninstall from "@/hooks/use-uninstall";
import logger from "@/lib/logger";
import { usePersistedStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ModStatus } from "@/types/mods";

interface ModButtonProps {
  remoteMod: Pick<ModDto, "remoteId" | "name" | "downloadable"> | undefined;
  variant: "iconOnly" | "default";
}

export const ModStatusIcon = ({
  status,
  hovering,
  className,
  forceLoading,
}: {
  status: ModStatus | undefined;
  hovering?: boolean;
  className?: string;
  forceLoading?: boolean;
}) => {
  const loadingStatuses = [
    ModStatus.Downloading,
    ModStatus.Removing,
    ModStatus.Installing,
  ];
  const Icon = useMemo(() => {
    if (forceLoading) {
      return Loader2;
    }
    switch (status) {
      case ModStatus.Downloading:
      case ModStatus.Removing:
      case ModStatus.Installing:
        return Loader2;
      case ModStatus.Downloaded:
        return hovering ? GrInstallOption : DownloadIcon;
      case ModStatus.Installed:
        return hovering ? X : Check;
      case ModStatus.FailedToDownload:
      case ModStatus.FailedToInstall:
      case ModStatus.FailedToRemove:
        return XIcon;
      case ModStatus.Removed:
      case ModStatus.Error:
        return RiErrorWarningLine;
      default:
        return PlusIcon;
    }
  }, [status, hovering, forceLoading]);

  return (
    <Icon
      className={cn(
        "h-4 w-4",
        {
          "animate-spin": forceLoading || (status && loadingStatuses.includes(status)),
        },
        className,
      )}
    />
  );
};

const ModButton = ({ remoteMod, variant = "default" }: ModButtonProps) => {
  const { availableFiles } = useModDownloads({
    remoteId: remoteMod?.remoteId,
    isDownloadable: remoteMod?.downloadable,
  });

  const { t } = useTranslation();
  const { analytics } = useAnalyticsContext();
  const {
    download,
    downloadSelectedFiles,
    closeDialog,
    localMod,
    isDialogOpen,
  } = useDownload(remoteMod, availableFiles);
  const {
    activate,
    isAnalyzing,
    currentFileTree,
    showFileSelector,
    setShowFileSelector,
    confirmActivation,
    cancelActivation,
    currentMod,
  } = useActivationWithCollection();
  const { uninstall } = useUninstall();
  const {
    setInstalledVpks,
    removeMod,
    setModStatus,
    setModEnabledInCurrentProfile,
    setParsedHeroes,
  } = usePersistedStore();
  const [ref, hovering] = useHover();
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const action = useCallback(async () => {
    if (isActionInProgress) {
      return;
    }

    setIsActionInProgress(true);

    try {
      switch (localMod?.status) {
        case undefined:
          await download();
          analytics.trackModDiscovered(
            remoteMod?.remoteId || "unknown",
            "browse",
          );
          break;
        case ModStatus.Downloaded:
          await activate(localMod, {
            onStart: (mod) => {
              setModStatus(mod.remoteId, ModStatus.Installing);
            },
            onComplete: (mod, result) => {
              setModStatus(mod.remoteId, ModStatus.Installed);
              setInstalledVpks(
                mod.remoteId,
                result.installed_vpks,
                result.file_tree,
              );
              if (result.parsed_heroes && result.parsed_heroes.length > 0) {
                setParsedHeroes(mod.remoteId, result.parsed_heroes);
              }
              setModEnabledInCurrentProfile(mod.remoteId, true);
              toast.success(t("notifications.modInstalledSuccessfully"));
              analytics.trackModInstalled(mod.remoteId, {
                vpk_count: result.installed_vpks.length,
                file_tree_complexity: result.file_tree?.has_multiple_files
                  ? "complex"
                  : "simple",
              });
            },
            onError: (mod, error) => {
              setModStatus(mod.remoteId, ModStatus.Error);
              toast.error(
                error.message || t("notifications.failedToInstallMod"),
              );
              analytics.trackError(
                "mod_installation",
                error.message || "Unknown installation error",
                {
                  mod_id: mod.remoteId,
                },
              );
            },
            onCancel: (mod) => {
              setModStatus(mod.remoteId, ModStatus.Downloaded);
              toast.info(t("notifications.installationCanceled"));
            },
            onFileTreeAnalyzed: (mod, fileTree) => {
              if (fileTree.has_multiple_files) {
                toast.info(
                  t("notifications.modContainsFiles", {
                    modName: mod.name,
                    fileCount: fileTree.total_files,
                  }),
                );
              }
            },
          });
          break;
        case ModStatus.Installed:
          await uninstall(localMod, false);
          analytics.trackModUninstalled(localMod.remoteId, "user_choice");
          break;
        case ModStatus.FailedToDownload:
          break;
        case ModStatus.Error:
          removeMod(localMod.remoteId);
          break;
        default:
          break;
      }
    } finally {
      setTimeout(() => {
        setIsActionInProgress(false);
      }, 300);
    }
  }, [
    isActionInProgress,
    localMod,
    download,
    activate,
    uninstall,
    removeMod,
    setModStatus,
    setInstalledVpks,
    setModEnabledInCurrentProfile,
    setParsedHeroes,
    t,
    analytics,
    remoteMod?.remoteId,
  ]);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isActionInProgress) {
        return;
      }

      try {
        e.stopPropagation();
        await action();
      } catch (error) {
        logger.error("Failed to perform action", { error });
        toast.error(t("notifications.failedToPerformAction"));
        setIsActionInProgress(false);
      }
    },
    [isActionInProgress, action, t],
  );

  const text = useMemo(() => {
    switch (localMod?.status) {
      case ModStatus.Installed:
        if (hovering) {
          return t("modButton.disableMod");
        }
        return t("modButton.installed");
      case ModStatus.Downloaded:
        if (hovering) {
          return t("modButton.enableMod");
        }
        return t("modButton.downloaded");
      case undefined:
        return t("modButton.add");
      default:
        return t(`modButton.${localMod?.status}`);
    }
  }, [localMod?.status, t, hovering]);

  const tooltip = useMemo(() => {
    switch (localMod?.status) {
      case ModStatus.Installed:
        return t("modButton.installedTooltip");
      case ModStatus.Downloaded:
        return t("modButton.downloadedTooltip");
      case undefined:
        return t("modButton.add");
      default:
        return t(`modButton.${localMod?.status}`);
    }
  }, [localMod?.status, t]);

  const buttonVariant = useMemo(() => {
    switch (localMod?.status) {
      case ModStatus.Installed:
        if (hovering) {
          return "destructive";
        }
        return "link";
      case ModStatus.Downloaded:
        if (hovering) {
          return "default";
        }
        return "outline";
      default:
        return variant === "iconOnly" ? "outline" : "default";
    }
  }, [variant, localMod?.status, hovering]);

  return (
    <ErrorBoundary>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={isActionInProgress || isAnalyzing}
            icon={
              <ModStatusIcon
                hovering={hovering}
                status={localMod?.status}
                forceLoading={isAnalyzing || isActionInProgress}
              />
            }
            onClick={onClick}
            ref={ref}
            size={variant === "iconOnly" ? "icon" : "lg"}
            title={text}
            variant={buttonVariant}>
            {variant === "iconOnly" ? null : text}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>

      <FileSelectorDialog
        fileTree={currentFileTree}
        isOpen={showFileSelector}
        modName={currentMod?.name}
        onCancel={cancelActivation}
        onConfirm={confirmActivation}
        onOpenChange={setShowFileSelector}
      />

      <MultiFileDownloadDialog
        files={availableFiles}
        isDownloading={localMod?.status === ModStatus.Downloading}
        isOpen={isDialogOpen}
        modName={localMod?.name || t("modForm.unknownMod")}
        onClose={closeDialog}
        onDownload={downloadSelectedFiles}
      />
    </ErrorBoundary>
  );
};

export default ModButton;