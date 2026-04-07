import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTemplateSections(templateId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['template-sections', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('checklist_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!templateId,
  });
}

export function useTemplateItems(sectionIds?: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['template-items', sectionIds],
    queryFn: async () => {
      if (!sectionIds?.length) return [];
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sectionIds?.length,
  });
}

export function useImportChecklist() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ name, sections, items }: {
      name: string;
      sections: Array<{ name: string; source: 'EA' | 'EMPr'; sort_order: number }>;
      items: Array<{ sectionIndex: number; condition_ref: string; description: string; source: 'EA' | 'EMPr'; sort_order: number }>;
    }) => {
      // Create template
      const { data: tpl, error: tplErr } = await supabase
        .from('checklist_templates')
        .insert({ name, organisation_id: profile?.organisation_id || null })
        .select()
        .single();
      if (tplErr) throw tplErr;

      // Create sections
      const sectionInserts = sections.map(s => ({
        template_id: tpl.id,
        name: s.name,
        source: s.source,
        sort_order: s.sort_order,
      }));
      const { data: secs, error: secErr } = await supabase
        .from('checklist_sections')
        .insert(sectionInserts)
        .select();
      if (secErr) throw secErr;

      // Create items mapped to section IDs
      const itemInserts = items.map(item => ({
        section_id: secs[item.sectionIndex].id,
        condition_ref: item.condition_ref,
        description: item.description,
        source: item.source,
        sort_order: item.sort_order,
      }));
      const { error: itemErr } = await supabase
        .from('checklist_items')
        .insert(itemInserts);
      if (itemErr) throw itemErr;

      return tpl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Checklist imported successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
