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

export function useMultiTemplateSections(templateIds?: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['template-sections-multi', templateIds],
    queryFn: async () => {
      if (!templateIds?.length) return [];
      const { data, error } = await supabase
        .from('checklist_sections')
        .select('*')
        .in('template_id', templateIds)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!templateIds?.length,
  });
}

export function useTemplateObjectives(sectionIds?: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['template-objectives', sectionIds],
    queryFn: async () => {
      if (!sectionIds?.length) return [];
      const { data, error } = await supabase
        .from('checklist_objectives')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sectionIds?.length,
  });
}

export function useTemplateItems(objectiveIds?: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['template-items', objectiveIds],
    queryFn: async () => {
      if (!objectiveIds?.length) return [];
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .in('objective_id', objectiveIds)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!objectiveIds?.length,
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      // Get sections
      const { data: sections } = await supabase
        .from('checklist_sections')
        .select('id')
        .eq('template_id', templateId);
      if (sections?.length) {
        const sIds = sections.map(s => s.id);
        // Get objectives
        const { data: objectives } = await supabase
          .from('checklist_objectives')
          .select('id')
          .in('section_id', sIds);
        if (objectives?.length) {
          const oIds = objectives.map(o => o.id);
          await supabase.from('checklist_items').delete().in('objective_id', oIds);
        }
        await supabase.from('checklist_objectives').delete().in('section_id', sIds);
      }
      await supabase.from('checklist_sections').delete().eq('template_id', templateId);
      const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sections: Array<{ id: string; sort_order: number }>) => {
      for (const s of sections) {
        const { error } = await supabase
          .from('checklist_sections')
          .update({ sort_order: s.sort_order })
          .eq('id', s.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-sections'] });
      qc.invalidateQueries({ queryKey: ['template-sections-multi'] });
      toast.success('Section order updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderObjectives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (objectives: Array<{ id: string; sort_order: number }>) => {
      for (const o of objectives) {
        const { error } = await supabase
          .from('checklist_objectives')
          .update({ sort_order: o.sort_order })
          .eq('id', o.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-objectives'] });
      toast.success('Objective order updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useImportChecklist() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ name, phases, objectives, tasks }: {
      name: string;
      phases: Array<{ name: string; source: 'EA' | 'EMPr'; sort_order: number }>;
      objectives: Array<{ phaseIndex: number; name: string; source: 'EA' | 'EMPr'; sort_order: number }>;
      tasks: Array<{ objectiveIndex: number; condition_ref: string; description: string; source: 'EA' | 'EMPr'; sort_order: number }>;
    }) => {
      // Create template
      const { data: tpl, error: tplErr } = await supabase
        .from('checklist_templates')
        .insert({ name, organisation_id: profile?.organisation_id || null })
        .select()
        .single();
      if (tplErr) throw tplErr;

      // Create phases (sections)
      const phaseInserts = phases.map(p => ({
        template_id: tpl.id,
        name: p.name,
        source: p.source,
        sort_order: p.sort_order,
      }));
      const { data: phasesData, error: phaseErr } = await supabase
        .from('checklist_sections')
        .insert(phaseInserts)
        .select();
      if (phaseErr) throw phaseErr;

      // Create objectives
      const objInserts = objectives.map(o => ({
        section_id: phasesData[o.phaseIndex].id,
        name: o.name,
        source: o.source,
        sort_order: o.sort_order,
      }));
      const { data: objsData, error: objErr } = await supabase
        .from('checklist_objectives')
        .insert(objInserts)
        .select();
      if (objErr) throw objErr;

      // Create tasks (items)
      const taskInserts = tasks.map(t => ({
        objective_id: objsData[t.objectiveIndex].id,
        condition_ref: t.condition_ref,
        description: t.description,
        source: t.source,
        sort_order: t.sort_order,
      }));
      const { error: taskErr } = await supabase
        .from('checklist_items')
        .insert(taskInserts);
      if (taskErr) throw taskErr;

      return tpl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Checklist imported successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
