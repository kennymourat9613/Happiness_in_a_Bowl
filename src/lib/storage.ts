import { supabase } from './supabase';

export async function getItem(key: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('app_data')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('storage.getItem error', key, error);
    return null;
  }

  return data ? data.value : null;
}

export async function setItem(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('app_data')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    console.error('storage.setItem error', key, error);
  }
}

export async function removeItem(key: string): Promise<void> {
  const { error } = await supabase
    .from('app_data')
    .delete()
    .eq('key', key);

  if (error) {
    console.error('storage.removeItem error', key, error);
  }
}
