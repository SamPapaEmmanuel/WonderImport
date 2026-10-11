/** Public configuration. Only NEXT_PUBLIC_* values are available in the browser bundle. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Copy frontend/.env.example to frontend/.env.local and fill it in.`);
  return value;
}

export const publicEnv = {
  apiUrl: required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL),
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};
