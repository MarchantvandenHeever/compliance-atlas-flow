

## Plan: Assign Admin Role & Build User Management

### What this does
1. Assigns the `admin` role to user Marchant van den Heever (ID: `76053593-...`)
2. Adds INSERT policies on checklist tables so the import works
3. Adds a new "Users" admin page to view all users and assign/remove roles

### Steps

**Step 1 — Database changes (migration + data insert)**

*Data insert* — Assign admin role:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('76053593-e29d-4306-a81c-4b7475317755', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

*Migration* — Add INSERT policies for checklist tables so admins (and auditors) can import:
```sql
CREATE POLICY "Authenticated can insert templates"
ON public.checklist_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can insert sections"
ON public.checklist_sections FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can insert items"
ON public.checklist_items FOR INSERT TO authenticated WITH CHECK (true);
```

Also update `profiles` RLS so admins can view all profiles:
```sql
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

**Step 2 — Create Users management page (`src/pages/Users.tsx`)**

- Fetches all profiles (admin can see all via new policy)
- Fetches all user_roles
- Displays a table: Name, Email (from display_name), Current Roles
- Each row has a dropdown/buttons to assign or remove roles (`admin`, `eco_auditor`, `reviewer`, `client_viewer`)
- Role changes insert/delete from `user_roles` table

**Step 3 — Add route and navigation**

- Add `/users` route in `App.tsx` wrapped with `<ProtectedRoute requiredRoles={['admin']}>`
- Add "Users" nav item (with Shield icon) in `AppLayout.tsx` nav items array

### Technical Details

- The Users page will use `supabase.from('profiles').select('*')` — works because of the new admin SELECT policy
- Role assignment: `supabase.from('user_roles').insert({ user_id, role })` — works because admins already have ALL on `user_roles`
- Role removal: `supabase.from('user_roles').delete().eq('user_id', id).eq('role', role)`
- No new tables needed; leverages existing `user_roles` and `profiles` tables

