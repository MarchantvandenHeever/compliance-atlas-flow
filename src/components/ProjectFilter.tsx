interface Props {
  projects: Array<{ id: string; name: string; client: string }>;
  selectedProjectId: string;
  onChange: (id: string) => void;
}

export default function ProjectFilter({ projects, selectedProjectId, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground">Project:</label>
      <select
        value={selectedProjectId}
        onChange={e => onChange(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm min-w-[200px]"
      >
        <option value="">All Projects</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
        ))}
      </select>
    </div>
  );
}
