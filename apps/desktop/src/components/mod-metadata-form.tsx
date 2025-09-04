import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export type ModMetadata = {
  name: string;
  author?: string;
  link?: string;
  description?: string;
  imageFile?: File | null;
  imageSrc?: string;
};

export type ModMetadataFormProps = {
  initial?: Partial<ModMetadata>;
  title?: string;
  description?: string;
  hideCardChrome?: boolean;
};

export type ModMetadataFormHandle = {
  validateAndGet: () => Promise<ModMetadata | null>;
  reset: () => void;
};

const DEFAULT_IMAGE = '/assets/mod-placeholder.png';
const FALLBACK_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
      <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1f2937" offset="0"/><stop stop-color="#111827" offset="1"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <g font-family="Inter, Arial, sans-serif" fill="#E5E7EB" text-anchor="middle">
        <text x="50%" y="48%" font-size="36" font-weight="700">MOD</text>
        <text x="50%" y="62%" font-size="14" fill="#9CA3AF">No image provided</text>
      </g>
    </svg>`
  );

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  author: z.string().max(128, 'Too long').optional().or(z.literal('').transform(() => undefined)),
  description: z.string().max(4000, 'Too long').optional().or(z.literal('').transform(() => undefined)),
  link: z.string().url('Invalid URL').optional().or(z.literal('').transform(() => undefined)),
  imageFile: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

const Inner = React.forwardRef<ModMetadataFormHandle, ModMetadataFormProps>(function ModMetadataForm(
  { initial, title = 'Mod metadata', description = 'Add optional details. Only the name is required.', hideCardChrome = false },
  ref
) {
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [imgOk, setImgOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      author: initial?.author ?? 'Unknown',
      description: initial?.description ?? '',
      link: initial?.link ?? '',
      imageFile: initial?.imageFile ?? null,
    },
  });

  const resolvedDefault = useMemo(() => DEFAULT_IMAGE, []);
  useEffect(() => {
    const sub = form.watch((_, { name }) => {
      if (name === 'imageFile') {
        const f = form.getValues('imageFile') as File | null | undefined;
        if (f instanceof File) {
          const url = URL.createObjectURL(f);
          setPreview(url);
          setImgOk(true);
          return () => URL.revokeObjectURL(url);
        } else if (initial?.imageSrc) {
          setPreview(initial.imageSrc);
          setImgOk(true);
        } else {
          setPreview(resolvedDefault);
          setImgOk(true);
        }
      }
    });
    const initF = form.getValues('imageFile') as File | null | undefined;
    if (initF instanceof File) {
      const url = URL.createObjectURL(initF);
      setPreview(url);
      setImgOk(true);
      return () => URL.revokeObjectURL(url);
    } else if (initial?.imageSrc) {
      setPreview(initial.imageSrc);
    } else {
      setPreview(resolvedDefault);
    }
    return () => sub.unsubscribe();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      form.setValue('imageFile', null);
      setPreview(resolvedDefault);
      setImgOk(true);
      return;
    }
    const ok = /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
    if (!ok) {
      toast.error('Unsupported image type');
      e.currentTarget.value = '';
      return;
    }
    form.setValue('imageFile', file, { shouldValidate: true });
  };

  const clearImage = () => {
    form.setValue('imageFile', null, { shouldValidate: true });
    setPreview(resolvedDefault);
    setImgOk(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  useImperativeHandle(ref, () => ({
    validateAndGet: async () => {
      const valid = await form.trigger();
      if (!valid) return null;
      const values = form.getValues();
      const meta: ModMetadata = {
        name: values.name.trim(),
        author: values.author?.trim() || undefined,
        description: values.description?.trim() || undefined,
        link: values.link?.trim() || undefined,
        imageFile: values.imageFile instanceof File ? values.imageFile : null,
        imageSrc: (preview && imgOk ? preview : FALLBACK_SVG),
      };
      return meta;
    },
    reset: () => {
      form.reset({
        name: initial?.name ?? '',
        author: initial?.author ?? 'Unknown',
        description: initial?.description ?? '',
        link: initial?.link ?? '',
        imageFile: null,
      });
      clearImage();
    },
  }), [form, preview, imgOk, initial]);

  const Body = (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {}
      <div className="md:col-span-4">
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
          <img
            src={preview}
            alt="Mod preview"
            className="h-full w-full object-cover"
            onError={() => { setImgOk(false); setPreview(FALLBACK_SVG); }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg"
            className="hidden"
            onChange={handleImageChange}
          />
          <Button type="button" onClick={() => fileRef.current?.click()}>Choose image</Button>
          <Button type="button" variant="secondary" onClick={clearImage}>Use default</Button>
        </div>
      </div>

      {}
      <div className="md:col-span-8 space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl><Input placeholder="Awesome Mod" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Author</FormLabel>
                <FormControl><Input placeholder="Unknown" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <FormControl><Input placeholder="https://example.com/mod" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <textarea
                  rows={6}
                  placeholder="Short description (optional)"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0 focus-visible:ring-2 focus-visible:ring-ring"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  if (hideCardChrome) {
    return (
      <Form {...form}>
        <form onSubmit={(e) => { e.preventDefault(); }}>
          {Body}
        </form>
      </Form>
    );
  }

  return (
    <Card className="w-full border-0 shadow">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); }}>
            {Body}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
});

export default Inner;
