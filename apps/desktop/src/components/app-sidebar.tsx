import {
  DiscordLogo,
  Download,
  Gear,
  type Icon,
  MagnifyingGlass,
  Package,
  Sparkle,
  UploadSimple,
} from '@phosphor-icons/react';
import { open } from '@tauri-apps/plugin-shell';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import useWhatsNew from '@/hooks/use-whats-new';
import { usePersistedStore } from '@/lib/store';
import { ModStatus } from '@/types/mods';
import { SidebarCollapse } from './sidebar-collapse';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';

type SidebarItem = {
  id: string;
  title: ({
    isActive,
    count,
    downloads,
  }: {
    isActive?: boolean;
    count?: number;
    downloads?: number;
  }) => React.ReactNode;
  url: string;
  icon: Icon;
};

const getSidebarItems = (t: (key: string) => string): SidebarItem[] => [
  {
    id: 'my-mods',
    title: ({ isActive, count }: { isActive?: boolean; count?: number }) => (
      <div className="flex items-center gap-2">
        {t('navigation.myMods')}{' '}
        {count !== undefined && (
          <Badge
            className="px-1 py-0.1 text-xs"
            variant={isActive ? 'inverted' : 'default'}
          >
            {count}
          </Badge>
        )}
      </div>
    ),
    url: '/',
    icon: Package,
  },
  {
    id: 'get-mods',
    title: () => <span>{t('navigation.getMods')}</span>,
    url: '/mods',
    icon: MagnifyingGlass,
  },
  {
    id: 'add-mods',
    title: () => <span>{t('navigation.addMods')}</span>,
    url: '/add-mods',
    icon: UploadSimple,
  },
  {
    id: 'downloads',
    title: ({ downloads }: { downloads?: number }) => (
      <span>
        {t('navigation.downloads')}{' '}
        {downloads !== undefined && downloads > 0 && (
          <Badge className="px-1 py-0.1 text-xs">{downloads}</Badge>
        )}
      </span>
    ),
    url: '/downloads',
    icon: Download,
  },
  {
    id: 'settings',
    title: () => <span>{t('navigation.settings')}</span>,
    url: '/settings',
    icon: Gear,
  },
];

const DownloadProgress = () => {
  const { t } = useTranslation();
  const mods = usePersistedStore((state) => state.mods);
  const modProgress = usePersistedStore((state) => state.modProgress);

  const downloadingMods = mods.filter(
    (mod) => mod.status === ModStatus.DOWNLOADING
  );
  if (downloadingMods.length === 0) {
    return null;
  }

  // Calculate the combined progress of all downloads
  let totalProgress = 0;
  let modsWithProgress = 0;

  for (const mod of downloadingMods) {
    const progress = modProgress[mod.remoteId];
    if (
      progress?.percentage &&
      !Number.isNaN(progress.percentage) &&
      Number.isFinite(progress.percentage)
    ) {
      totalProgress += progress.percentage;
      modsWithProgress++;
    }
  }

  const averageProgress =
    modsWithProgress > 0 ? totalProgress / modsWithProgress : 0;
  const displayPercentage =
    Number.isNaN(averageProgress) || !Number.isFinite(averageProgress)
      ? 0
      : Math.round(averageProgress);

  return (
    <div className="px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span>
          {t('downloads.downloading', { count: downloadingMods.length })}
        </span>
        <span>
          {t('downloads.percentage', { percentage: displayPercentage })}
        </span>
      </div>
      <Progress className="h-1" value={displayPercentage} />
    </div>
  );
};

export const AppSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const mods = usePersistedStore((state) => state.mods);
  const { forceShow } = useWhatsNew();

  const items = getSidebarItems(t);

  return (
    <Sidebar
      className="absolute top-10 left-0 z-10 flex h-[calc(100vh-40px)] w-[12rem] flex-col"
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarContent className="flex-grow">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon weight="duotone" />
                      {item.title({
                        isActive: location.pathname === item.url,
                        count: item.id === 'my-mods' ? mods.length : undefined,
                        downloads:
                          item.id === 'downloads'
                            ? mods.filter(
                                (mod) => mod.status === ModStatus.DOWNLOADING
                              ).length
                            : undefined,
                      })}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <DownloadProgress />
              <Separator />
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="cursor-pointer"
                  onClick={() => forceShow()}
                >
                  <Sparkle weight="duotone" />
                  <span>{t('navigation.whatsNew')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="cursor-pointer"
                  onClick={() => open('https://discord.gg/KSB2kzQWWE')}
                >
                  <DiscordLogo weight="duotone" />
                  <span>{t('help.needHelp')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarCollapse />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
};
