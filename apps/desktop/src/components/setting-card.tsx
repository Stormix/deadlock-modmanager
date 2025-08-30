import { useState } from 'react';
import { usePersistedStore } from '@/lib/store';
import { LocalSetting } from '@/types/settings';
import { CustomSettingType } from '@deadlock-mods/utils';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Switch } from './ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { PencilIcon, TrashIcon } from 'lucide-react';

interface SettingsCardProps {
  setting: LocalSetting | undefined;
  onChange: (newValue: boolean) => void;
}

function parseCommand(input: string): { key: string; value: string } {
  const t = input.trim();
  const noPlus = t.startsWith('+') ? t.slice(1) : t;
  const [k, ...rest] = noPlus.split(/\s+/);
  const key = (k || '').trim();
  const value = (rest.join(' ') || '').trim();
  return { key, value };
}

const Command = ({ setting }: Pick<SettingsCardProps, 'setting'>) => {
  if (!setting) return null;

  if (setting.type != CustomSettingType.LAUNCH_OPTION) {
    return (
      <code>
        {setting.key} {setting.value}
      </code>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger className="flex flex-row items-center gap-2">
        Command:
        <code
          className="underline-offset-4 underline decoration-dotted cursor-copy"
          onClick={() => {
            navigator.clipboard.writeText(`+${setting.key} ${setting.value}`);
            toast.success('Copied to clipboard');
          }}
        >
          +{setting.key} {setting.value}
        </code>
      </TooltipTrigger>
      <TooltipContent>
        <p>Copy to clipboard</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const SettingCardSkeleton = () => {
  return (
    <div className="flex flex-row justify-between items-center pl-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">
          <Skeleton className="w-48 h-6" />
        </h3>
        <div className="text-sm text-muted-foreground">
          <Skeleton className="w-96 h-4" />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="toggle-setting" disabled />
        <Label htmlFor="toggle-setting">
          <Skeleton className="w-16 h-4" />
        </Label>
      </div>
    </div>
  );
};

const SettingCard = ({ setting, onChange }: SettingsCardProps) => {
  const addSetting = usePersistedStore((s) => s.addSetting);
  const removeSetting = usePersistedStore((s) => s.removeSetting);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCmd, setEditCmd] = useState('');

  if (!setting) return <SettingCardSkeleton />;
  const custom = setting.id.startsWith('local_setting_');

  const openEdit = () => {
    setEditName(setting.description ?? '');
    const cmd =
      setting.type === CustomSettingType.LAUNCH_OPTION
        ? `+${setting.key}${setting.value ? ` ${setting.value}` : ''}`
        : `${setting.key}${setting.value ? ` ${setting.value}` : ''}`;
    setEditCmd(cmd.trim());
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!custom) return;

    const { key, value } = parseCommand(editCmd);
    if (!key) return toast.error('Command key is required');
    if (setting.type === CustomSettingType.LAUNCH_OPTION && !value) {
      return toast.error('Command value is required');
    }

    const updated: LocalSetting = {
      ...setting,
      description: editName?.trim() || setting.description,
      key,
      value,
      updatedAt: new Date()
    };

    addSetting(updated);
    setEditOpen(false);
    toast.success('Setting updated');
  };

  const deleteSetting = () => {
    if (!custom) return;
    removeSetting(setting.id);
    toast.success('Setting removed');
  };

  return (
    <>
      <div className="flex flex-row justify-between items-center pl-8">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-medium">
            {setting.description} {custom && <Badge>Custom</Badge>}
          </h3>
          <p className="text-sm text-muted-foreground">
            <Command setting={setting} />
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {custom && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={openEdit} aria-label="Edit">
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={deleteSetting} aria-label="Delete">
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          <Switch id="toggle-setting" checked={setting.enabled} onCheckedChange={onChange} />
          <Label htmlFor="toggle-setting">{!setting.enabled ? 'Disabled' : 'Enabled'}</Label>
        </div>
      </div>

      {/* dialog for custom settings */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit custom option</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`name-${setting.id}`}>Name</Label>
              <Input id={`name-${setting.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. 110 FOV" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`cmd-${setting.id}`}>Command</Label>
              <Input id={`cmd-${setting.id}`} value={editCmd} onChange={(e) => setEditCmd(e.target.value)} placeholder="+r_aspectratio 2.7" />
              <span className="text-xs text-muted-foreground">Format: +cvar value (leading + is optional)</span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingCard;