import { UploadSimple, Info } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import JSZip from 'jszip';

import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, exists, mkdir, writeFile, readDir } from '@tauri-apps/plugin-fs';

import PageTitle from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MOD_CATEGORY_ORDER, ModCategory } from '@/lib/constants';
import { cn } from '@/lib/utils';

import ModMetadataForm, { type ModMetadata, type ModMetadataFormHandle } from '@/components/mod-metadata-form';
import { usePersistedStore } from '@/lib/store';
import { ModStatus } from '@/types/mods';

type DetectedSource =
  | { kind: 'archive'; file: File }
  | { kind: 'vpk'; file: File }
  | { kind: 'folder-vpk'; files: File[]; folderName?: string };

const isGameBananaUrl = (url: string) => /^https?:\/\/(www\.)?gamebanana\.com\//i.test(url.trim());
const fileName = (file: File) => (file as any).webkitRelativePath || file.name;
const toBytes = async (f: File) => new Uint8Array(await f.arrayBuffer());
const ensureDir = async (abs: string) => { if (!(await exists(abs, { baseDir: BaseDirectory.AppLocalData }))) await mkdir(abs, { recursive: true, baseDir: BaseDirectory.AppLocalData }); };
const writeBytes = async (abs: string, data: Uint8Array) => writeFile(abs, data, { baseDir: BaseDirectory.AppLocalData });
const writeText = async (abs: string, text: string) => writeFile(abs, new TextEncoder().encode(text), { baseDir: BaseDirectory.AppLocalData });
const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('read fail')); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });

const detectSource = (files: File[]): DetectedSource | null => {
  if (!files?.length) return null;
  const flat = files.filter(Boolean);
  const vpk = flat.find((f) => /\.vpk$/i.test(f.name));
  if (flat.length === 1 && vpk) return { kind: 'vpk', file: vpk };
  const archive = flat.find((f) => /\.(zip|rar|7z)$/i.test(f.name));
  if (flat.length === 1 && archive) return { kind: 'archive', file: archive };
  const anyVpk = flat.filter((f) => /\.vpk$/i.test(f.name));
  if (anyVpk.length >= 1) {
    const first = anyVpk[0] as any;
    const rel = first.webkitRelativePath as string | undefined;
    const folderName = rel ? rel.split('/')[0] : undefined;
    return { kind: 'folder-vpk', files: anyVpk, folderName };
  }
  return null;
};

const readFromDataTransferItems = async (items: DataTransferItemList): Promise<File[]> => {
  const promises: Promise<File[]>[] = [];
  const toFiles = async (entry: any, path = ''): Promise<File[]> => {
    if (!entry) return [];
    if (entry.isFile) {
      return new Promise<File[]>((resolve) => {
        entry.file((file: File) => {
          file.webkitRelativePath = path + file.name;
          resolve([file]);
        });
      });
    }
    if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise<File[]>((resolve) => {
        const entries: any[] = [];
        const readEntries = () => {
          dirReader.readEntries(async (batch: any[]) => {
            if (!batch.length) {
              const nested = await Promise.all(entries.map((e) => toFiles(e, path + entry.name + '/')));
              resolve(nested.flat());
            } else {
              entries.push(...batch);
              readEntries();
            }
          });
        };
        readEntries();
      });
    }
    return [];
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) promises.push(toFiles(entry));
    else if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) promises.push(Promise.resolve([file]));
    }
  }
  const arrays = await Promise.all(promises);
  return arrays.flat();
};

const addModSchema = z.object({
  category: z.nativeEnum(ModCategory),
  sourceType: z.enum(['url', 'archive', 'vpk', 'folder-vpk']),
  url: z.string().optional(),
});
type AddModValues = z.infer<typeof addModSchema>;

const AddMods = () => {
  const [open, setOpen] = useState(false);
  const [detected, setDetected] = useState<DetectedSource | null>(null);
  const [dragging, setDragging] = useState(false);
  const [initialMeta, setInitialMeta] = useState<Partial<ModMetadata> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const metaRef = useRef<ModMetadataFormHandle>(null);

  const { addMod, setModPath, setModStatus } = usePersistedStore();

  const form = useForm<AddModValues>({
    resolver: zodResolver(addModSchema),
    defaultValues: { category: ModCategory.SKINS, sourceType: 'vpk', url: undefined },
  });

  useEffect(() => {
    const prevent = (e: Event) => { e.preventDefault(); };
    window.addEventListener('dragenter', prevent as any, { passive: false });
    window.addEventListener('dragover', prevent as any, { passive: false });
    window.addEventListener('drop', prevent as any, { passive: false });
    return () => {
      window.removeEventListener('dragenter', prevent as any);
      window.removeEventListener('dragover', prevent as any);
      window.removeEventListener('drop', prevent as any);
    };
  }, []);

  const startDialog = (ds: DetectedSource | { kind: 'url'; url: string; name?: string }) => {
    if ('kind' in ds && ds.kind === 'url') {
      form.reset({ category: ModCategory.SKINS, sourceType: 'url', url: ds.url });
      setDetected(null);
      setInitialMeta({ name: ds.name || '' });
    } else {
      const n =
        ds.kind === 'archive'
          ? ds.file.name.replace(/\.(zip|rar|7z)$/i, '')
          : ds.kind === 'vpk'
          ? ds.file.name.replace(/\.vpk$/i, '')
          : ds.folderName || ds.files[0]?.name.replace(/\.vpk$/i, '') || '';
      setDetected(ds as DetectedSource);
      form.reset({ category: ModCategory.SKINS, sourceType: (ds as DetectedSource).kind, url: undefined });
      setInitialMeta({ name: n || '' });
    }
    setOpen(true);
  };

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const types = Array.from(e.dataTransfer.types || []);
    if (!types.includes('Files')) return;

    let files = Array.from(e.dataTransfer.files || []);
    if ((!files.length || files.every(f => !f)) && e.dataTransfer.items?.length) {
      const fromItems = await readFromDataTransferItems(e.dataTransfer.items);
      if (fromItems.length) files = fromItems;
    }

    const ds = detectSource(files);
    if (!ds) { toast.error('Unsupported file(s).'); return; }
    startDialog(ds);
  }, []);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const ds = detectSource(files);
    if (!ds) { toast.error('Unsupported selection.'); return; }
    startDialog(ds);
  };

  const finalize = async () => {
    const meta = await metaRef.current?.validateAndGet();
    if (!meta) return;
    const category = form.getValues('category');

    if (form.getValues('sourceType') === 'url') {
      toast.info('URL flow is handled by the API pipeline.');
      setOpen(false);
      return;
    }
    if (!detected) { toast.error('No files detected.'); return; }

    const modId = `local-${crypto.randomUUID()}`;
    const base = await appLocalDataDir();
    const modsRoot = await join(base, 'mods');
    const modDir = await join(modsRoot, modId);
    const filesDir = await join(modDir, 'files');
    await ensureDir(modsRoot);
    await ensureDir(modDir);
    await ensureDir(filesDir);

    let previewName = 'preview.svg';
    if (meta.imageFile) {
      const extMatch = meta.imageFile.name.match(/\.(png|jpe?g|webp|gif|svg)$/i);
      previewName = `preview${extMatch ? extMatch[0].toLowerCase() : '.png'}`;
      await writeBytes(await join(modDir, previewName), await toBytes(meta.imageFile));
    } else {
      const FALLBACK_SVG =
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1f2937" offset="0"/><stop stop-color="#111827" offset="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g font-family="Inter, Arial, sans-serif" fill="#E5E7EB" text-anchor="middle"><text x="50%" y="48%" font-size="36" font-weight="700">MOD</text><text x="50%" y="62%" font-size="14" fill="#9CA3AF">No image provided</text></g></svg>`;
      await writeText(await join(modDir, previewName), FALLBACK_SVG);
    }

    try {
      if (detected.kind === 'vpk') {
        await writeBytes(await join(filesDir, detected.file.name), await toBytes(detected.file));
      } else if (detected.kind === 'folder-vpk') {
        const first = detected.files.sort((a, b) => fileName(a).localeCompare(fileName(b))).find((f) => /\.vpk$/i.test(f.name));
        if (!first) throw new Error('No .vpk found in folder');
        await writeBytes(await join(filesDir, first.name), await toBytes(first));
      } else if (detected.kind === 'archive') {
        const name = detected.file.name.toLowerCase();
        if (name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(await detected.file.arrayBuffer());
          const entry = Object.values(zip.files).find((f) => !f.dir && /\.vpk$/i.test(f.name));
          if (!entry) {
            await writeBytes(await join(modDir, detected.file.name), await toBytes(detected.file));
            toast.error('No .vpk found inside .zip – stored archive for installer');
          } else {
            const buf = await entry.async('uint8array');
            const baseName = entry.name.split('/').pop() || 'mod.vpk';
            await writeBytes(await join(filesDir, baseName), buf);
          }
        } else {
          await writeBytes(await join(modDir, detected.file.name), await toBytes(detected.file));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to process archive');
      if ('file' in detected) {
        await writeBytes(await join(modDir, detected.file.name), await toBytes(detected.file as File));
      }
    }

    const filesList = await readDir(filesDir, { baseDir: BaseDirectory.AppLocalData });
    const hasVpk = filesList.some((e) => /\.vpk$/i.test(e.name || ''));
    if (!hasVpk && detected.kind === 'archive') {
      await writeBytes(await join(modDir, detected.file.name), await toBytes(detected.file));
    }

    const metadata = {
      id: modId,
      kind: 'local',
      name: meta.name,
      author: meta.author || 'Unknown',
      link: meta.link || null,
      description: meta.description || null,
      category,
      createdAt: new Date().toISOString(),
      preview: previewName,
      _schema: 1,
    };
    await writeText(await join(modDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    const imageDataUrl =
      meta.imageFile
        ? await fileToDataUrl(meta.imageFile)
        : 'data:image/svg+xml;utf8,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1f2937" offset="0"/><stop stop-color="#111827" offset="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g font-family="Inter, Arial, sans-serif" fill="#E5E7EB" text-anchor="middle"><text x="50%" y="48%" font-size="36" font-weight="700">MOD</text><text x="50%" y="62%" font-size="14" fill="#9CA3AF">No image provided</text></g></svg>`
          );

    const modDto: any = {
      remoteId: modId,
      name: metadata.name,
      description: metadata.description ?? '',
      remoteUrl: metadata.link ?? 'local://manual',
      author: metadata.author,
      downloadable: false,
      remoteAddedAt: metadata.createdAt,
      remoteUpdatedAt: metadata.createdAt,
      tags: [],
      images: [imageDataUrl],
      hero: null,
      downloadCount: 0,
      likes: 0,
      category,
    };

    addMod(modDto, { path: modDir, status: ModStatus.DOWNLOADED });
    setModPath(modId, modDir);
    setModStatus(modId, ModStatus.DOWNLOADED);

    toast.success(`Added: ${meta.name}`);
    setOpen(false);
  };

  const UrlHint = (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="h-4 w-4" />
      <span>Only GameBanana URLs are supported for now (e.g. https://gamebanana.com/mods/XXXXX).</span>
    </div>
  );

  return (
    <div className="h-full w-full">
      <div className="space-y-4 px-6 md:px-8">
        <PageTitle title="Add Mods" description="Add a mod via URL or by uploading files. Drag & drop is supported." />

        <Card className="w-full border-0 shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadSimple weight="duotone" />
              Add Mods
            </CardTitle>
            <CardDescription>Provide a GameBanana URL or upload files below.</CardDescription>
          </CardHeader>

        <CardContent className="space-y-6 pb-8">
            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="mod-url" className="text-sm font-semibold">Mod URL</Label>
              <div className="flex gap-2">
                <Input
                  id="mod-url"
                  placeholder="https://gamebanana.com/mods/..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value;
                      if (!isGameBananaUrl(v)) { toast.error('Only GameBanana URLs are supported right now.'); return; }
                      const guessName = v.split('/').filter(Boolean).pop();
                      startDialog({ kind: 'url', url: v, name: guessName });
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const v = (document.getElementById('mod-url') as HTMLInputElement)?.value || '';
                    if (!isGameBananaUrl(v)) { toast.error('Only GameBanana URLs are supported right now.'); return; }
                    const guessName = v.split('/').filter(Boolean).pop();
                    startDialog({ kind: 'url', url: v, name: guessName });
                  }}
                >
                  Continue
                </Button>
              </div>
              {UrlHint}
            </div>

            <Separator />

            {/* Files */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UploadSimple className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Add Files</h3>
              </div>
              <p className="text-xs text-muted-foreground">Drop a .vpk, a folder with .vpk, or a .zip/.rar/.7z archive.</p>

              <div
                onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={async (e) => {
                  e.preventDefault(); e.stopPropagation(); setDragging(false);
                  let files = Array.from(e.dataTransfer.files || []);
                  if ((!files.length || files.every(f => !f)) && e.dataTransfer.items?.length) {
                    const fromItems = await readFromDataTransferItems(e.dataTransfer.items);
                    if (fromItems.length) files = fromItems;
                  }
                  const ds = detectSource(files);
                  if (!ds) { toast.error('Unsupported file(s).'); return; }
                  startDialog(ds);
                }}
                className={cn(
                  'relative flex h-40 md:h-48 w-full cursor-pointer items-center justify-center rounded-md border border-dashed transition-colors',
                  dragging ? 'ring-2 ring-primary/40 bg-muted/50' : 'hover:bg-muted/40'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  // @ts-ignore
                  webkitdirectory="true"
                  directory="true"
                  onChange={onPickFiles}
                  accept=".vpk,.zip,.rar,.7z,application/zip,application/x-7z-compressed,application/x-rar-compressed"
                />
                <div className="pointer-events-none text-center">
                  <UploadSimple className="mx-auto h-8 w-8" />
                  <div className="mt-2 text-sm font-medium">Drop files/folders here, or click to select</div>
                  <div className="text-xs text-muted-foreground">Supported: .vpk, folder with .vpk, .zip/.rar/.7z</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Finalize details</DialogTitle>
            <DialogDescription>Only the name is required. You can fill the rest later.</DialogDescription>
          </DialogHeader>

          <ModMetadataForm ref={metaRef} initial={initialMeta} hideCardChrome />

          <div className="mt-4 space-y-4">
            <Form {...form}>
              <form onSubmit={(e) => e.preventDefault()}>
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                        <SelectContent>{MOD_CATEGORY_ORDER.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            {/* source summary */}
            <div className="rounded-md bg-muted p-3 text-xs">
              {form.getValues('sourceType') === 'archive' ? (
                <div><span className="font-medium">Source:</span> Archive → {(detected as any)?.file?.name}</div>
              ) : detected?.kind === 'vpk' ? (
                <div><span className="font-medium">Source:</span> VPK → {fileName((detected as any).file)}</div>
              ) : detected?.kind === 'folder-vpk' ? (
                <div>
                  <div><span className="font-medium">Source:</span> Folder with {detected.files.length} VPK file(s){detected.folderName ? ` → ${detected.folderName}` : ''}</div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={finalize}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMods;
